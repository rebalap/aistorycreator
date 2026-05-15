import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_SCENES = 20;

interface SubmitBody {
  storyId: string;
  voiceId: string;
  speed?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  transition?: "cut" | "fade" | "slide_left" | "slide_right" | "slide_up" | "slide_down";
  styleTemplate?: "classic" | "playful" | "cinematic";
  includeCover?: boolean;
  framesByPage?: Record<string, string>;
  coverFrameUrl?: string;
  pageTexts?: Record<string, string>;
  coverTitle?: string;
  language?: string;
  pauseDuration?: number;
  mode?: "custom" | "template";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const HEYGEN_API_KEY = Deno.env.get("HEYGEN_API_KEY");
  if (!HEYGEN_API_KEY) {
    return new Response(JSON.stringify({ error: "Service unavailable" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    // Accept action/video_id/story_id from query string OR JSON body (invoke() strips query strings).
    let bodyJson: any = null;
    if (req.method !== "GET") {
      try { bodyJson = await req.clone().json(); } catch { bodyJson = null; }
    }
    const action = url.searchParams.get("action") ?? bodyJson?.action ?? "submit";

    if (action === "status") {
      const videoId = url.searchParams.get("video_id") ?? bodyJson?.video_id;
      if (!videoId) {
        return new Response(JSON.stringify({ error: "video_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const res = await fetch(
        `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
        { headers: { "X-Api-Key": HEYGEN_API_KEY } },
      );
      const json = await res.json();
      const d = json?.data ?? {};
      const status = d.status; // pending | processing | completed | failed
      const result = {
        status,
        video_url: d.video_url ?? null,
        thumbnail_url: d.thumbnail_url ?? null,
        duration: d.duration ?? null,
        error: d.error ?? null,
      };

      // Persist when completed
      if (status === "completed" && result.video_url) {
        const storyId = url.searchParams.get("story_id") ?? bodyJson?.story_id;
        if (storyId) {
          await supabase.from("stories")
            .update({
              video_url: result.video_url,
              video_thumbnail_url: result.thumbnail_url,
              heygen_video_id: videoId,
              video_generated_at: new Date().toISOString(),
            })
            .eq("id", storyId);
        }
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SUBMIT
    const body: SubmitBody = bodyJson ?? (await req.json());
    if (!body?.storyId || typeof body.storyId !== "string") {
      return new Response(JSON.stringify({ error: "storyId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.voiceId) {
      return new Response(JSON.stringify({ error: "voiceId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const speed = Math.min(2, Math.max(0.5, body.speed ?? 1));
    const rawPause = body.pauseDuration ?? 0;
    // HeyGen silence voice supports 1.0-100.0s; 0 disables pauses.
    const pauseDuration = rawPause > 0 ? Math.min(100, Math.max(1, rawPause)) : 0;
    const aspect = body.aspectRatio ?? "16:9";
    const dimension = aspect === "9:16"
      ? { width: 720, height: 1280 }
      : aspect === "1:1"
      ? { width: 1080, height: 1080 }
      : { width: 1280, height: 720 };

    // Load story + pages
    const { data: story, error: sErr } = await supabase
      .from("stories")
      .select("id, user_id, title, title_en, title_ar, title_te, cover_image_url, video_url")
      .eq("id", body.storyId)
      .single();
    if (sErr || !story) {
      return new Response(JSON.stringify({ error: "Story not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Any authenticated user can generate a video for any story (community editing model)

    const { data: pages, error: pErr } = await supabase
      .from("story_pages")
      .select("page_number, text, text_en, text_ar, text_te, image_url")
      .eq("story_id", body.storyId)
      .order("page_number", { ascending: true });
    if (pErr) throw pErr;

    const lang = body.language === "ar" || body.language === "te" ? body.language : "en";
    const pageLangCol = lang === "ar" ? "text_ar" : lang === "te" ? "text_te" : "text_en";
    const titleLangCol = lang === "ar" ? "title_ar" : lang === "te" ? "title_te" : "title_en";

    const usable = (pages ?? []).filter((p) => {
      const t = ((p as any)[pageLangCol]?.trim() || p.text?.trim());
      return t && p.image_url;
    });
    if (usable.length === 0) {
      return new Response(JSON.stringify({ error: "Story has no narratable pages with images" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const framesByPage = body.framesByPage ?? {};
    const pageTexts = body.pageTexts ?? {};
    // Prefer client-supplied (live UI) → language-specific DB column → generic title (last resort)
    const effectiveTitle = (
      body.coverTitle?.trim()
      || (story as any)[titleLangCol]?.trim()
      || story.title
      || ""
    ).trim();
    const scenes: { text: string; image: string }[] = [];
    if (body.includeCover && (body.coverFrameUrl || story.cover_image_url)) {
      scenes.push({
        text: effectiveTitle,
        image: body.coverFrameUrl || story.cover_image_url!,
      });
    }
    for (const p of usable) {
      const frame = framesByPage[String(p.page_number)] || p.image_url;
      const text = pageTexts[String(p.page_number)]?.trim()
        || (p as any)[pageLangCol]?.trim()
        || p.text;
      scenes.push({ text, image: frame });
    }
    if (scenes.length > MAX_SCENES) scenes.length = MAX_SCENES;

    // ============= TEMPLATE MODE =============
    if (body.mode === "template") {
      const TEMPLATE_ID = Deno.env.get("HEYGEN_TEMPLATE_ID");
      if (!TEMPLATE_ID) {
        return new Response(JSON.stringify({ error: "HEYGEN_TEMPLATE_ID not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Discover template variables
      const tRes = await fetch(`https://api.heygen.com/v2/template/${encodeURIComponent(TEMPLATE_ID)}`, {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });
      const tRaw = await tRes.text();
      let tJson: any = null;
      try { tJson = JSON.parse(tRaw); } catch {}
      if (!tRes.ok) {
        console.error("HeyGen template fetch failed", { status: tRes.status, body: tRaw.slice(0, 600) });
        return new Response(JSON.stringify({ error: `HeyGen template fetch ${tRes.status}: ${tRaw.slice(0, 400)}` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const tplVars: Record<string, any> = tJson?.data?.variables ?? {};
      const variables: Record<string, any> = {};
      let imageIdx = 0;
      let textIdx = 0;
      for (const [name, meta] of Object.entries(tplVars)) {
        const type = (meta as any)?.type;
        if (type === "image") {
          const scene = scenes[imageIdx++];
          if (scene) {
            variables[name] = { name, type: "image", properties: { url: scene.image, asset_id: null, fit: "cover" } };
          }
        } else if (type === "text") {
          const scene = scenes[textIdx++];
          if (scene) {
            variables[name] = { name, type: "text", properties: { content: scene.text.slice(0, 1500) } };
          }
        } else if (type === "voice") {
          variables[name] = { name, type: "voice", properties: { voice_id: body.voiceId } };
        } else if (type === "character") {
          // leave as-is from template
        }
      }

      const tplPayload = {
        caption: false,
        title: (effectiveTitle || "Story video").slice(0, 150),
        dimension,
        variables,
      };
      const tplPayloadStr = JSON.stringify(tplPayload);
      console.log("heygen template submit", {
        template_id: TEMPLATE_ID,
        variable_count: Object.keys(variables).length,
        scenes: scenes.length,
        language: lang,
        first_text_preview: scenes[0]?.text?.slice(0, 80),
      });

      const gRes = await fetch(`https://api.heygen.com/v2/template/${encodeURIComponent(TEMPLATE_ID)}/generate`, {
        method: "POST",
        headers: { "X-Api-Key": HEYGEN_API_KEY, "Content-Type": "application/json" },
        body: tplPayloadStr,
      });
      const gRaw = await gRes.text();
      const gTrace = gRes.headers.get("x-trace-id") || gRes.headers.get("x-request-id");
      let gJson: any = null;
      try { gJson = JSON.parse(gRaw); } catch {}
      if (!gRes.ok || !gJson?.data?.video_id) {
        console.error("HeyGen template submit error", { status: gRes.status, body: gRaw.slice(0, 800), gTrace });
        const msg = gJson?.error?.message || gJson?.message || gRaw || "Failed to submit template video";
        return new Response(JSON.stringify({
          error: `HeyGen ${gRes.status}: ${msg}`,
          heygen_status: gRes.status,
          heygen_body: gJson ?? gRaw,
          trace_id: gTrace,
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("generation_logs").insert({
        user_id: user.id,
        story_id: body.storyId,
        generation_type: "video",
      });

      return new Response(JSON.stringify({ video_id: gJson.data.video_id, status: "pending" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // ============= /TEMPLATE MODE =============

    // Avatar removed: HeyGen v2 requires a character, so we render a tiny
    // off-canvas placeholder using a built-in avatar so the resulting video
    // shows only background + narration.
    const PLACEHOLDER_AVATAR_ID = "Daisy-inskirt-20220818";
    const characterPlaceholder = {
      type: "avatar",
      avatar_id: PLACEHOLDER_AVATAR_ID,
      avatar_style: "normal",
      scale: 0.001,
      offset: { x: 1, y: 1 },
    };

    const transitionType = body.transition ?? "slide_left";

    const buildSceneInput = (s: { text: string; image: string }) => ({
      character: characterPlaceholder,
      voice: {
        type: "text",
        input_text: s.text.slice(0, 1500),
        voice_id: body.voiceId,
        speed,
      },
      background: { type: "image", url: s.image },
    });

    const buildSilenceInput = (image: string) => ({
      character: characterPlaceholder,
      voice: { type: "silence", duration: pauseDuration },
      background: { type: "image", url: image },
    });

    let video_inputs: any[] = [];
    for (let i = 0; i < scenes.length; i++) {
      video_inputs.push(buildSceneInput(scenes[i]));
      if (pauseDuration > 0 && i < scenes.length - 1) {
        video_inputs.push(buildSilenceInput(scenes[i].image));
      }
    }

    // Attach transition to every scene EXCEPT the last (transition plays into the next scene).
    if (transitionType !== "cut") {
      for (let i = 0; i < video_inputs.length - 1; i++) {
        video_inputs[i].transition = { type: transitionType };
      }
    }

    // Trim to MAX_SCENES: drop trailing silence(s) first, then trailing page scenes.
    if (video_inputs.length > MAX_SCENES) {
      const before = video_inputs.length;
      while (video_inputs.length > MAX_SCENES && video_inputs[video_inputs.length - 1]?.voice?.type === "silence") {
        video_inputs.pop();
      }
      while (video_inputs.length > MAX_SCENES) {
        video_inputs.pop();
        // also drop any trailing silence left dangling
        while (video_inputs.length > 0 && video_inputs[video_inputs.length - 1]?.voice?.type === "silence") {
          video_inputs.pop();
        }
      }
      console.log("heygen scene trim", { before, after: video_inputs.length, max: MAX_SCENES });
    }

    const payload = {
      video_inputs,
      dimension,
      caption: false,
      title: (effectiveTitle || "Story video").slice(0, 150),
    };

    const payloadStr = JSON.stringify(payload);
    console.log("heygen submit start", {
      storyId: body.storyId,
      scenes: scenes.length,
      dimension,
      language: body.language,
      transition: transitionType,
      payload_bytes: payloadStr.length,
      first_image: scenes[0]?.image?.slice(0, 120),
      first_text_preview: scenes[0]?.text?.slice(0, 80),
    });

    const ctrl = new AbortController();
    const TIMEOUT_MS = 120_000;
    const timeoutId = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const startedAt = Date.now();
    let res: Response;
    try {
      res = await fetch("https://api.heygen.com/v2/video/generate", {
        method: "POST",
        headers: {
          "X-Api-Key": HEYGEN_API_KEY,
          "Content-Type": "application/json",
        },
        body: payloadStr,
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(timeoutId);
      const elapsed_ms = Date.now() - startedAt;
      console.error("HeyGen submit fetch failed", { elapsed_ms, error: String(e) });
      return new Response(JSON.stringify({
        error: `HeyGen submit failed after ${elapsed_ms}ms: ${String(e)}`,
        elapsed_ms,
      }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    clearTimeout(timeoutId);
    const elapsed_ms = Date.now() - startedAt;
    const rawText = await res.text();
    const traceId = res.headers.get("x-trace-id") || res.headers.get("x-request-id");
    console.log("heygen submit response", { status: res.status, elapsed_ms, traceId, body_preview: rawText.slice(0, 800) });
    let json: any = null;
    try { json = JSON.parse(rawText); } catch { /* non-JSON body */ }
    if (!res.ok || !json?.data?.video_id) {
      console.error("HeyGen submit error", { status: res.status, traceId, rawText });
      const msg =
        json?.error?.message ||
        json?.message ||
        (typeof json?.error === "string" ? json.error : null) ||
        rawText ||
        "Failed to submit video";
      return new Response(JSON.stringify({
        error: `HeyGen ${res.status}: ${msg}`,
        heygen_status: res.status,
        heygen_body: json ?? rawText,
        trace_id: traceId,
        elapsed_ms,
      }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("heygen submit ok", { video_id: json.data.video_id, elapsed_ms });

    await supabase.from("generation_logs").insert({
      user_id: user.id,
      story_id: body.storyId,
      generation_type: "video",
    });

    return new Response(JSON.stringify({ video_id: json.data.video_id, status: "pending" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("heygen-generate-video error", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
