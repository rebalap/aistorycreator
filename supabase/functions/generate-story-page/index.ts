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

    const { characterImage, backgroundImages, storyText, previousImages, pageNumber, totalPages } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!characterImage) {
      throw new Error("Character image is required");
    }

    if (!storyText) {
      throw new Error("Story text is required");
    }

    console.log(`Generating story page ${pageNumber || 1} with text:`, storyText.substring(0, 100) + "...");

    // Convert character image to base64
    const characterImageBase64 = await toBase64DataUrl(characterImage);

    // Build the prompt for image generation with character consistency
    let prompt = `Create a children's book illustration in an 8:9 portrait aspect ratio (width:height = 8:9, approximately 960x1080 pixels).

CRITICAL STYLE REQUIREMENTS:
- Match EXACTLY the illustration style of the provided main character (protagonist) image
- Pay special attention to the EYES and MOUTH style - use the SAME artistic approach for depicting facial features (shape, line work, expressiveness, proportions, dot eyes vs detailed eyes, smile style, etc.)
- ALL characters in this scene MUST have eyes and mouth drawn in the IDENTICAL style as the protagonist
- Match the color palette, line thickness, and artistic technique throughout
- The protagonist's face style is the canonical reference for ALL character faces

`;
    
    // Add character consistency instructions if there are previous pages
    if (previousImages && previousImages.length > 0) {
      prompt += `MULTI-PAGE CONSISTENCY (Page ${pageNumber}):
- The protagonist and all characters MUST look EXACTLY the same as in the previous page images
- Same appearance, clothing, colors, proportions, and art style
- ESPECIALLY maintain the SAME eyes and mouth illustration style across all pages
- Characters must be immediately recognizable from page to page

`;
    }
    
    prompt += `SCENE TO ILLUSTRATE: "${storyText}"

ADDITIONAL REQUIREMENTS:
- IMPORTANT: Do NOT include any text, words, letters, numbers, or captions in the image
- The illustration should be in the same whimsical, storybook style as the character reference
- Use similar colors, line work, and artistic techniques
- Make it warm, inviting, and magical
- Output the image in 8:9 portrait format (tall rectangle, NOT square) with no text`;

    if (backgroundImages && backgroundImages.length > 0) {
      prompt += `
- Also use the provided background reference images to guide the environment, scenery, and color palette`;
    }

    // Build message content with images
    const messageContent: any[] = [
      {
        type: "text",
        text: prompt,
      },
      {
        type: "image_url",
        image_url: {
          url: characterImageBase64,
        },
      },
    ];

    // Add previous page images for character consistency (most recent first)
    if (previousImages && previousImages.length > 0) {
      console.log(`Converting ${previousImages.length} previous images to base64 for character consistency`);
      for (const prevImage of previousImages) {
        const prevImageBase64 = await toBase64DataUrl(prevImage);
        messageContent.push({
          type: "image_url",
          image_url: {
            url: prevImageBase64,
          },
        });
      }
    }

    // Add background images if provided
    if (backgroundImages && backgroundImages.length > 0) {
      console.log(`Converting ${backgroundImages.length} background images to base64`);
      for (const bgImage of backgroundImages) {
        const bgImageBase64 = await toBase64DataUrl(bgImage);
        messageContent.push({
          type: "image_url",
          image_url: {
            url: bgImageBase64,
          },
        });
      }
    }

    console.log("Calling Lovable AI for image generation...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "You've run out of AI credits! Add more credits to your Lovable workspace to continue creating beautiful stories.",
            code: "CREDITS_EXHAUSTED"
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response received");

    // Extract the generated image
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!generatedImage) {
      console.error("No image in response:", JSON.stringify(data));
      throw new Error("No image was generated");
    }

    console.log(`Story page ${pageNumber || 1} generated successfully`);

    return new Response(
      JSON.stringify({ image: generatedImage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in generate-story-page:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
