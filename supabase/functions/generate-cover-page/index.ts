import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const prompt = `Create a beautiful children's book COVER illustration in 16:9 landscape aspect ratio.

STORY TITLE: "${title}"

CRITICAL REQUIREMENTS:
1. The title "${title}" MUST be prominently displayed as decorative, whimsical, hand-drawn storybook text
2. Position the title at the top or center of the image - make it large and eye-catching
3. Feature the provided character (the protagonist) prominently in the center or foreground of the scene
4. The character MUST look EXACTLY like the reference image - same features, colors, style, proportions
5. Create a warm, magical, inviting atmosphere perfect for a children's book cover
6. Use bright, engaging, cheerful colors
7. Make it look like a professional book cover that would be on a bookshelf
8. DO NOT include any other text like "written by", "by", author names, or any additional words
9. The style should match the character's illustration style perfectly
10. Add decorative elements around the title (stars, swirls, sparkles) to make it magical

This is a COVER image, so make it visually stunning and captivating.`;

    const messageContent: any[] = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: characterImage } },
    ];

    // Add background images as style references if provided
    if (backgroundImages && backgroundImages.length > 0) {
      backgroundImages.slice(0, 2).forEach((bgUrl: string) => {
        messageContent.push({ type: "image_url", image_url: { url: bgUrl } });
      });
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
