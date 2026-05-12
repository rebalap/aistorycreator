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
  avatarId: string;
  speed?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  transition?: "cut" | "fade" | "slide";
  styleTemplate?: "classic" | "playful" | "cinematic";
  includeCover?: boolean;
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
        const { searchParams } = url;
        const storyId = searchParams.get("story_id");
        if (storyId) {
          await supabase.from("stories")
            .update({
              video_url: result.video_url,
              video_thumbnail_url: result.thumbnail_url,
              heygen_video_id: videoId,
              video_generated_at: new Date().toISOString(),
            })
            .eq("id", storyId)
            .eq("user_id", user.id);
        }
      }

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // SUBMIT
    const body: SubmitBody = await req.json();
    if (!body?.storyId || typeof body.storyId !== "string") {
      return new Response(JSON.stringify({ error: "storyId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.voiceId || !body.avatarId) {
      return new Response(JSON.stringify({ error: "voiceId and avatarId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const speed = Math.min(2, Math.max(0.5, body.speed ?? 1));
    const aspect = body.aspectRatio ?? "16:9";
    const dimension = aspect === "9:16"
      ? { width: 720, height: 1280 }
      : aspect === "1:1"
      ? { width: 1080, height: 1080 }
      : { width: 1280, height: 720 };

    // Load story + pages
    const { data: story, error: sErr } = await supabase
      .from("stories")
      .select("id, user_id, title, cover_image_url, video_url")
      .eq("id", body.storyId)
      .single();
    if (sErr || !story) {
      return new Response(JSON.stringify({ error: "Story not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (story.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pages, error: pErr } = await supabase
      .from("story_pages")
      .select("page_number, text, image_url")
      .eq("story_id", body.storyId)
      .order("page_number", { ascending: true });
    if (pErr) throw pErr;

    const usable = (pages ?? []).filter((p) => p.text?.trim() && p.image_url);
    if (usable.length === 0) {
      return new Response(JSON.stringify({ error: "Story has no narratable pages with images" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scenes: any[] = [];
    if (body.includeCover && story.cover_image_url) {
      scenes.push({ text: story.title || "", image: story.cover_image_url });
    }
    for (const p of usable) scenes.push({ text: p.text, image: p.image_url });
    if (scenes.length > MAX_SCENES) scenes.length = MAX_SCENES;

    const video_inputs = scenes.map((s) => ({
      character: {
        type: "avatar",
        avatar_id: body.avatarId,
        avatar_style: "normal",
        scale: 0.35,
        offset: { x: 0.35, y: 0.35 },
      },
      voice: {
        type: "text",
        input_text: s.text.slice(0, 1500),
        voice_id: body.voiceId,
        speed,
      },
      background: { type: "image", url: s.image },
    }));

    const payload = {
      video_inputs,
      dimension,
      caption: false,
      title: (story.title || "Story video").slice(0, 150),
    };

    const res = await fetch("https://api.heygen.com/v2/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": HEYGEN_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok || !json?.data?.video_id) {
      console.error("HeyGen submit error", res.status, json);
      const msg = json?.error?.message || json?.message || "Failed to submit video";
      return new Response(JSON.stringify({ error: msg }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
