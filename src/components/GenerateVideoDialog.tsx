import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Play, Pause, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Voice {
  voice_id: string;
  name: string;
  language: string;
  gender?: string;
  preview_audio?: string;
}
interface Avatar {
  avatar_id: string;
  avatar_name: string;
  gender?: string;
  preview_image_url?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storyId: string | null;
  hasCover: boolean;
  onCompleted?: (videoUrl: string, thumbnailUrl: string | null) => void;
}

export const GenerateVideoDialog = ({ open, onOpenChange, storyId, hasCover, onCompleted }: Props) => {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);

  const [voiceFilter, setVoiceFilter] = useState("");
  const [voiceLang, setVoiceLang] = useState<string>("all");
  const [voiceId, setVoiceId] = useState<string>("");
  const [avatarId, setAvatarId] = useState<string>("");

  const [speed, setSpeed] = useState(1);
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [transition, setTransition] = useState<"cut" | "fade" | "slide">("fade");
  const [styleTemplate, setStyleTemplate] = useState<"classic" | "playful" | "cinematic">("playful");
  const [includeCover, setIncludeCover] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingLists(true);
    Promise.all([
      supabase.functions.invoke("heygen-list-voices"),
      supabase.functions.invoke("heygen-list-avatars"),
    ]).then(([v, a]) => {
      if (cancelled) return;
      if (v.error) toast.error("Failed to load voices");
      else setVoices((v.data as any)?.voices ?? []);
      if (a.error) toast.error("Failed to load avatars");
      else setAvatars((a.data as any)?.avatars ?? []);
    }).finally(() => !cancelled && setLoadingLists(false));
    return () => { cancelled = true; };
  }, [open]);

  const languages = useMemo(() => {
    const s = new Set<string>();
    voices.forEach((v) => v.language && s.add(v.language));
    return ["all", ...Array.from(s).sort()];
  }, [voices]);

  const filteredVoices = useMemo(() => {
    return voices.filter((v) => {
      if (voiceLang !== "all" && v.language !== voiceLang) return false;
      if (voiceFilter && !`${v.name} ${v.language}`.toLowerCase().includes(voiceFilter.toLowerCase())) return false;
      return true;
    }).slice(0, 200);
  }, [voices, voiceFilter, voiceLang]);

  const previewVoice = (v: Voice) => {
    if (!v.preview_audio) return;
    if (audioRef.current && previewingId === v.voice_id) {
      audioRef.current.pause();
      setPreviewingId(null);
      return;
    }
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(v.preview_audio);
    audioRef.current = a;
    a.onended = () => setPreviewingId(null);
    a.play().then(() => setPreviewingId(v.voice_id)).catch(() => setPreviewingId(null));
  };

  const stopPreview = () => { audioRef.current?.pause(); setPreviewingId(null); };

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const pollStatus = async (videoId: string) => {
    setPolling(true);
    setStatusMsg("Rendering on HeyGen…");
    const start = Date.now();
    const TIMEOUT_MS = 12 * 60 * 1000;
    while (Date.now() - start < TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, 6000));
      const { data, error } = await supabase.functions.invoke("heygen-generate-video", {
        body: { action: "status", video_id: videoId, story_id: storyId },
      });
      if (error) { setStatusMsg("Status check failed, retrying…"); continue; }
      const d = data as any;
      if (d.status === "completed" && d.video_url) {
        setPolling(false);
        setStatusMsg("");
        toast.success("Video ready!");
        onCompleted?.(d.video_url, d.thumbnail_url ?? null);
        onOpenChange(false);
        return;
      }
      if (d.status === "failed") {
        setPolling(false);
        setStatusMsg("");
        toast.error(`Video generation failed: ${d.error?.message ?? "unknown error"}`);
        return;
      }
      setStatusMsg(`Rendering… (${Math.round((Date.now() - start) / 1000)}s)`);
    }
    setPolling(false);
    setStatusMsg("");
    toast.error("Timed out waiting for video. Check HeyGen later.");
  };

  const handleGenerate = async () => {
    if (!storyId) { toast.error("Save the story first"); return; }
    if (!voiceId) { toast.error("Pick a voice"); return; }
    if (!avatarId) { toast.error("Pick an avatar"); return; }
    stopPreview();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("heygen-generate-video", {
        body: { storyId, voiceId, avatarId, speed, aspectRatio, transition, styleTemplate, includeCover },
      });
      if (error) throw error;
      const videoId = (data as any)?.video_id;
      if (!videoId) throw new Error("No video id returned");
      await pollStatus(videoId);
    } catch (e: any) {
      toast.error(e?.message || "Failed to start video");
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || polling;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Video className="w-5 h-5" /> Generate Book Video</DialogTitle>
          <DialogDescription>
            HeyGen will narrate each page over its illustration. The resulting video URL is saved on this story.
          </DialogDescription>
        </DialogHeader>

        {loadingLists ? (
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
              <Label>Avatar (small corner narrator)</Label>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1">
                {avatars.slice(0, 24).map((a) => (
                  <button key={a.avatar_id} onClick={() => setAvatarId(a.avatar_id)}
                    className={`border rounded-md overflow-hidden text-left transition ${avatarId === a.avatar_id ? "ring-2 ring-primary" : "hover:border-foreground/30"}`}>
                    {a.preview_image_url ? <img src={a.preview_image_url} alt={a.avatar_name} className="w-full h-20 object-cover" /> : <div className="h-20 bg-muted" />}
                    <div className="p-1 text-[11px] truncate">{a.avatar_name}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Speed: {speed.toFixed(2)}×</Label>
                <Slider min={0.5} max={2} step={0.05} value={[speed]} onValueChange={(v) => setSpeed(v[0])} />
              </div>
              <div className="space-y-2">
                <Label>Aspect ratio</Label>
                <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16:9">16:9 Landscape</SelectItem>
                    <SelectItem value="9:16">9:16 Portrait</SelectItem>
                    <SelectItem value="1:1">1:1 Square</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Style</Label>
                <Select value={styleTemplate} onValueChange={(v) => setStyleTemplate(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classic">Classic</SelectItem>
                    <SelectItem value="playful">Playful</SelectItem>
                    <SelectItem value="cinematic">Cinematic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Transition hint</Label>
                <Select value={transition} onValueChange={(v) => setTransition(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cut">Cut</SelectItem>
                    <SelectItem value="fade">Fade</SelectItem>
                    <SelectItem value="slide">Slide</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {hasCover && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label>Include cover page</Label>
                  <p className="text-xs text-muted-foreground">Read the title over the cover image as the first scene.</p>
                </div>
                <Switch checked={includeCover} onCheckedChange={setIncludeCover} />
              </div>
            )}

            {statusMsg && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {statusMsg}</div>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={busy || loadingLists || !voiceId || !avatarId}>
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating…</> : <><Video className="w-4 h-4 mr-2" /> Generate</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
