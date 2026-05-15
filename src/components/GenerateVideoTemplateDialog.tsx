import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, Pause, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Voice { voice_id: string; name: string; language: string; gender?: string; preview_audio?: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storyId: string | null;
  hasCover: boolean;
  pageNumbers: number[];
  pageTexts: Record<number, string>;
  coverTitle: string;
  language: 'en' | 'ar' | 'te';
  renderPageFrame: (pageNumber: number) => Promise<Blob | null>;
  renderCoverFrame: () => Promise<Blob | null>;
  onCompleted?: (videoUrl: string, thumbnailUrl: string | null) => void;
}

export const GenerateVideoTemplateDialog = ({
  open, onOpenChange, storyId, hasCover, pageNumbers, pageTexts,
  coverTitle, language, renderPageFrame, renderCoverFrame, onCompleted,
}: Props) => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(false);
  const [voiceFilter, setVoiceFilter] = useState("");
  const [voiceLang, setVoiceLang] = useState<string>("all");
  const [voiceId, setVoiceId] = useState<string>("");
  const [speed, setSpeed] = useState(0.8);
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    supabase.functions.invoke("heygen-list-voices").then((v) => {
      if (cancelled) return;
      if (v.error) { toast.error("Failed to load voices"); return; }
      const list: Voice[] = (v.data as any)?.voices ?? [];
      setVoices(list);
      const target = language === 'ar' ? 'arabic' : language === 'te' ? 'telugu' : 'english';
      const match = Array.from(new Set(list.map((x) => x.language).filter(Boolean)))
        .find((l) => l.toLowerCase().includes(target));
      if (match) setVoiceLang(match);
    }).finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [open, language]);

  const languages = useMemo(() => {
    const s = new Set<string>();
    voices.forEach((v) => v.language && s.add(v.language));
    return ["all", ...Array.from(s).sort()];
  }, [voices]);

  const filteredVoices = useMemo(() => voices.filter((v) => {
    if (voiceLang !== "all" && v.language !== voiceLang) return false;
    if (voiceFilter && !`${v.name} ${v.language}`.toLowerCase().includes(voiceFilter.toLowerCase())) return false;
    return true;
  }).slice(0, 200), [voices, voiceFilter, voiceLang]);

  const previewVoice = (v: Voice) => {
    if (!v.preview_audio) return;
    if (audioRef.current && previewingId === v.voice_id) { audioRef.current.pause(); setPreviewingId(null); return; }
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(v.preview_audio);
    audioRef.current = a;
    a.onended = () => setPreviewingId(null);
    a.play().then(() => setPreviewingId(v.voice_id)).catch(() => setPreviewingId(null));
  };
  const stopPreview = () => { audioRef.current?.pause(); setPreviewingId(null); };
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const uploadFrame = async (path: string, blob: Blob): Promise<string> => {
    const { error: upErr } = await supabase.storage.from("story-images").upload(path, blob, { upsert: true, contentType: "image/png" });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
    const { data } = supabase.storage.from("story-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const prepareFrames = async () => {
    const ts = Date.now();
    const framesByPage: Record<string, string> = {};
    let coverFrameUrl: string | undefined;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const basePath = `${user.id}/video-frames/${storyId}`;
    const tasks: Array<() => Promise<void>> = [];
    if (hasCover) {
      tasks.push(async () => {
        const blob = await renderCoverFrame();
        if (!blob) throw new Error("Failed to render cover frame");
        coverFrameUrl = await uploadFrame(`${basePath}/cover-${ts}.png`, blob);
      });
    }
    for (const pageNumber of pageNumbers) {
      tasks.push(async () => {
        const blob = await renderPageFrame(pageNumber);
        if (!blob) throw new Error(`Failed to render page ${pageNumber}`);
        framesByPage[String(pageNumber)] = await uploadFrame(`${basePath}/page-${pageNumber}-${ts}.png`, blob);
      });
    }
    let done = 0; const total = tasks.length;
    const queue = [...tasks];
    const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) { const t = queue.shift(); if (!t) break; await t(); done++; setStatusMsg(`Preparing pages… (${done}/${total})`); }
    });
    await Promise.all(workers);
    return { framesByPage, coverFrameUrl };
  };

  const pollStatus = async (videoId: string) => {
    setPolling(true); setStatusMsg("Rendering on HeyGen…");
    const start = Date.now(); const TIMEOUT_MS = 12 * 60 * 1000;
    while (Date.now() - start < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 6000));
      const { data, error } = await supabase.functions.invoke("heygen-generate-video", {
        body: { action: "status", video_id: videoId, story_id: storyId },
      });
      if (error) { setStatusMsg("Status check failed, retrying…"); continue; }
      const d = data as any;
      if (d.status === "completed" && d.video_url) {
        setPolling(false); setStatusMsg(""); toast.success("Video ready!");
        onCompleted?.(d.video_url, d.thumbnail_url ?? null); onOpenChange(false); return;
      }
      if (d.status === "failed") {
        setPolling(false); setStatusMsg("");
        toast.error(`Video generation failed: ${d.error?.message ?? "unknown error"}`); return;
      }
      setStatusMsg(`Rendering… (${Math.round((Date.now() - start) / 1000)}s)`);
    }
    setPolling(false); setStatusMsg("");
    toast.error("Timed out waiting for video. Check HeyGen later.");
  };

  const handleGenerate = async () => {
    if (!storyId) { toast.error("Save the story first"); return; }
    if (!voiceId) { toast.error("Pick a voice"); return; }
    if (pageNumbers.length === 0) { toast.error("No narratable pages"); return; }
    stopPreview(); setSubmitting(true);
    try {
      setStatusMsg("Preparing pages…");
      const { framesByPage, coverFrameUrl } = await prepareFrames();
      setStatusMsg("Submitting to HeyGen template…");
      const { data, error } = await supabase.functions.invoke("heygen-generate-video", {
        body: {
          mode: "template",
          storyId, voiceId, speed,
          includeCover: hasCover,
          framesByPage, coverFrameUrl,
          pageTexts: Object.fromEntries(Object.entries(pageTexts).map(([k, v]) => [String(k), v])),
          coverTitle, language,
        },
      });
      if (error) {
        const d: any = data ?? {};
        const detail = d.error || d.heygen_body || error.message;
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }
      const videoId = (data as any)?.video_id;
      if (!videoId) throw new Error(`No video id returned: ${JSON.stringify(data)}`);
      await pollStatus(videoId);
    } catch (e: any) {
      console.error("Template generate failed", e);
      toast.error(e?.message || "Failed to start video", { duration: 12000 });
      setStatusMsg("");
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || polling;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wand2 className="w-5 h-5" /> Quick Video (Template)</DialogTitle>
          <DialogDescription>
            Uses your HeyGen template. Pick a voice — everything else (layout, transitions, dimensions) is defined by the template.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Voice</Label>
              <div className="flex gap-2">
                <Input placeholder="Search voices…" value={voiceFilter} onChange={(e) => setVoiceFilter(e.target.value)} />
                <Select value={voiceLang} onValueChange={setVoiceLang}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {languages.map((l) => <SelectItem key={l} value={l}>{l === "all" ? "All languages" : l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="border rounded-md max-h-48 overflow-y-auto divide-y">
                {filteredVoices.map((v) => (
                  <div key={v.voice_id} className={`flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-muted ${voiceId === v.voice_id ? "bg-muted" : ""}`} onClick={() => setVoiceId(v.voice_id)}>
                    <input type="radio" checked={voiceId === v.voice_id} onChange={() => setVoiceId(v.voice_id)} />
                    <div className="flex-1">
                      <div className="font-medium">{v.name}</div>
                      <div className="text-xs text-muted-foreground">{v.language} · {v.gender || "—"}</div>
                    </div>
                    {v.preview_audio && (
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); previewVoice(v); }}>
                        {previewingId === v.voice_id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                ))}
                {filteredVoices.length === 0 && <div className="p-4 text-sm text-muted-foreground">No voices match.</div>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Speed: {speed.toFixed(2)}×</Label>
              <Slider min={0.5} max={2} step={0.05} value={[speed]} onValueChange={(v) => setSpeed(v[0])} />
            </div>

            {statusMsg && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {statusMsg}</div>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={busy || loading || !voiceId}>
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</> : <><Wand2 className="w-4 h-4 mr-2" /> Generate</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
