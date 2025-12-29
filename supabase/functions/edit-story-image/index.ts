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
        JSON.stringify({ error: "Unauthorized. Please sign in to edit images." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    const { currentImage, editPrompt, referenceImages, currentPageNumber, characterImage } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!currentImage) {
      throw new Error("Current image is required");
    }

    if (!editPrompt) {
      throw new Error("Edit prompt is required");
    }

    console.log("Editing story image with prompt:", editPrompt);
    console.log("Reference images count:", referenceImages?.length || 0);
    console.log("Character image provided:", !!characterImage);

    // Convert current image to base64
    const currentImageBase64 = await toBase64DataUrl(currentImage);

    // Replace "protagonist" with descriptive reference
    const processedPrompt = editPrompt.replace(
      /\bprotagonist\b/gi, 
      "the main character (use the uploaded character reference image as the style guide)"
    );

    // Build prompt with reference context
    let prompt = `Edit this children's book illustration (page ${currentPageNumber || "unknown"}) based on this instruction: "${processedPrompt}".

CRITICAL STYLE CONSISTENCY:
- If editing or adding characters, ensure ALL characters have the SAME illustration style for EYES and MOUTH as the protagonist/main character
- Match the exact artistic approach for facial features: eye shape, pupil style, mouth expression technique
- The main character reference image defines the canonical style for all character facial features
- Maintain consistency in line work, color palette, and artistic technique`;

    if (characterImage) {
      prompt += `
- A main character reference image is provided - use it as the definitive style guide for all facial features`;
    }

    if (referenceImages && referenceImages.length > 0) {
      prompt += `
- Reference images from other pages are provided - use them to match characters, style, or elements as specified in the instruction`;
      referenceImages.forEach((ref: { pageNumber: number }) => {
        prompt += `
- Image from page ${ref.pageNumber} is included for reference`;
      });
    }

    prompt += `

IMPORTANT:
- Keep the same art style, color palette, and illustration technique
- Do NOT include any text, words, letters, or captions in the image
- Maintain the warm, inviting, magical storybook feel
- Output in 8:9 portrait aspect ratio (width:height = 8:9, approximately 960x1080 pixels) to fit the story page image frame
- The image frame is a tall portrait rectangle, NOT a square
- Do NOT include any text, words, letters, or captions in the image`;

    // Build message content with all images
    const messageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: currentImageBase64 } },
    ];

    // Add character image as style reference if provided
    if (characterImage) {
      const characterImageBase64 = await toBase64DataUrl(characterImage);
      messageContent.push({
        type: "image_url",
        image_url: { url: characterImageBase64 },
      });
    }

    // Add reference images
    if (referenceImages && referenceImages.length > 0) {
      console.log(`Converting ${referenceImages.length} reference images to base64`);
      for (const ref of referenceImages) {
        const refImageBase64 = await toBase64DataUrl(ref.image);
        messageContent.push({
          type: "image_url",
          image_url: { url: refImageBase64 },
        });
      }
    }

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
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ 
            error: "You've run out of AI credits! Add more credits to your Lovable workspace to continue creating beautiful stories.",
            code: "CREDITS_EXHAUSTED"
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const editedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!editedImage) {
      console.error("No image in response:", JSON.stringify(data));
      throw new Error("No edited image was generated");
    }

    console.log("Image edited successfully");

    return new Response(
      JSON.stringify({ image: editedImage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in edit-story-image:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
