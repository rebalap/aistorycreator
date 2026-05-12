import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const targetLanguage = body.targetLanguage;

    // Support both single text and batch texts
    const texts: string[] = body.texts || (body.text ? [body.text] : []);
    const isBatch = !!body.texts;

    if (texts.length === 0 || !targetLanguage) {
      return new Response(
        JSON.stringify({ error: "Missing text(s) or targetLanguage" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const langName = targetLanguage === "ar" ? "Arabic" : targetLanguage === "te" ? "Telugu" : "English";

    let systemPrompt: string;
    let userContent: string;

    if (texts.length === 1) {
      systemPrompt = `You are a translator for children's story books. Translate the given text to ${langName}. Keep it simple, age-appropriate, and preserve the storytelling tone. Return ONLY the translated text, nothing else.`;
      userContent = texts[0];
    } else {
      systemPrompt = `You are a translator for children's story books. Translate the following numbered texts to ${langName}. Keep them simple, age-appropriate, and preserve the storytelling tone. Return ONLY a JSON array of translated strings in the same order, nothing else. Example: ["translated1", "translated2"]`;
      userContent = texts.map((t, i) => `${i + 1}. ${t}`).join("\n");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Translation failed");
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim() || "";

    if (texts.length === 1 && !isBatch) {
      // Single text: backward compatible response
      return new Response(
        JSON.stringify({ translatedText: rawContent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Batch: parse JSON array from response
    let translatedTexts: string[];
    try {
      // Strip markdown code fences if present
      const cleaned = rawContent.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      translatedTexts = JSON.parse(cleaned);
      if (!Array.isArray(translatedTexts)) throw new Error("Not an array");
    } catch {
      // Fallback: parse numbered list format like "1. text\n2. text"
      const lines = rawContent.split("\n").filter((l: string) => l.trim());
      const parsed = lines.map((l: string) => l.replace(/^\d+\.\s*/, "").trim()).filter(Boolean);
      if (parsed.length === texts.length) {
        translatedTexts = parsed;
      } else {
        console.error("Failed to parse batch response:", rawContent);
        throw new Error("Translation response was not valid JSON array");
      }
    }

    return new Response(
      JSON.stringify({ translatedTexts }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Translation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Translation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
