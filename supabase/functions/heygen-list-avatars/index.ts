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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
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
      const res = await fetch("https://api.heygen.com/v2/avatars", {
        headers: { "X-Api-Key": HEYGEN_API_KEY },
      });
      if (!res.ok) {
        return new Response(JSON.stringify({ error: "Failed to load avatars" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const json = await res.json();
      const avatars = (json?.data?.avatars ?? []).map((a: any) => ({
        avatar_id: a.avatar_id,
        avatar_name: a.avatar_name,
        gender: a.gender,
        preview_image_url: a.preview_image_url,
        preview_video_url: a.preview_video_url,
      }));
      cache = { at: Date.now(), data: avatars };
    }

    return new Response(JSON.stringify({ avatars: cache.data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("heygen-list-avatars error", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
