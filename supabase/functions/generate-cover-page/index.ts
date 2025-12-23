import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to convert image URLs to base64 data URLs
async function toBase64DataUrl(imageInput: string): Promise<string> {
  // Already a data URL, return as-is
  if (imageInput.startsWith('data:')) {
    return imageInput;
  }
  
  try {
    console.log("Converting image URL to base64:", imageInput.substring(0, 50) + "...");
    const response = await fetch(imageInput);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64 = btoa(binary);
    const contentType = response.headers.get('content-type') || 'image/png';
    console.log("Successfully converted image to base64, content-type:", contentType);
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error("Error converting image to base64:", error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user authentication
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized. Please sign in to generate images." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    const { characterImage, title, backgroundImages } = await req.json();

    if (!characterImage) {
      return new Response(
        JSON.stringify({ error: "Character image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!title || !title.trim()) {
      return new Response(
        JSON.stringify({ error: "Story title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating cover for:", title);

    // Convert character image to base64
    const characterImageBase64 = await toBase64DataUrl(characterImage);

    const prompt = `Create a beautiful children's book COVER illustration in 16:9 landscape aspect ratio.

STORY THEME/CONTEXT: "${title}"

CRITICAL REQUIREMENTS:
1. DO NOT include ANY text, words, letters, or titles in the image - the image must be completely text-free
2. Feature the provided character (the protagonist) prominently in the scene
3. The character MUST look EXACTLY like the reference image - same features, colors, style, proportions
4. Create a warm, magical, inviting atmosphere perfect for a children's book cover
5. Use bright, engaging, cheerful colors
6. The style should match the character's illustration style perfectly
7. Leave some open/softer space at the top or center for title text to be overlaid later
8. Create a composition that works well as a book cover background
9. Add decorative elements (stars, swirls, sparkles, nature elements) to make it magical

This is a COVER image background - make it visually stunning but completely TEXT-FREE.`;

    const messageContent: any[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: characterImageBase64 } },
    ];

    // Add background images as style references if provided
    if (backgroundImages && backgroundImages.length > 0) {
      console.log(`Converting ${Math.min(backgroundImages.length, 2)} background images to base64`);
      const bgSlice = backgroundImages.slice(0, 2);
      for (const bgUrl of bgSlice) {
        const bgBase64 = await toBase64DataUrl(bgUrl);
        messageContent.push({ type: "image_url", image_url: { url: bgBase64 } });
      }
    }

    console.log("Calling AI gateway for cover generation...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: messageContent,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "Failed to generate cover image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("AI response received");

    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error("No image in response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "No cover image generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Cover generated successfully");

    return new Response(
      JSON.stringify({ image: imageUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating cover:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
