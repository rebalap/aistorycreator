import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cache: { at: number; data: any } | null = null;
const CACHE_MS = 60 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const HEYGEN_API_KEY = Deno.env.get("HEYGEN_API_KEY");
    if (!HEYGEN_API_KEY) {
      return new Response(JSON.stringify({ error: "Service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!cache || Date.now() - cache.at > CACHE_MS) {
      const res = await fetch("https://api.heygen.com/v2/voices", {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });
      if (!res.ok) {
        const t = await res.text();
        console.error("HeyGen voices error", res.status, t);
        return new Response(JSON.stringify({ error: "Failed to load voices" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const json = await res.json();
      const voices = (json?.data?.voices ?? []).map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        language: v.language,
        gender: v.gender,
        preview_audio: v.preview_audio,
        support_pause: v.support_pause,
        emotion_support: v.emotion_support,
      }));
      cache = { at: Date.now(), data: voices };
    }

    const url = new URL(req.url);
    const lang = url.searchParams.get("language");
    let voices = cache.data;
    if (lang) {
      const l = lang.toLowerCase();
      voices = voices.filter((v: any) => (v.language || "").toLowerCase().includes(l));
    }

    return new Response(JSON.stringify({ voices }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("heygen-list-voices error", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
