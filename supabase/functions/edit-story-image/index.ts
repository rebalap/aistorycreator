import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
- Output in square 1:1 format with no text`;

    // Build message content with all images
    const messageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: currentImage } },
    ];

    // Add character image as style reference if provided
    if (characterImage) {
      messageContent.push({
        type: "image_url",
        image_url: { url: characterImage },
      });
    }

    // Add reference images
    if (referenceImages && referenceImages.length > 0) {
      referenceImages.forEach((ref: { pageNumber: number; image: string }) => {
        messageContent.push({
          type: "image_url",
          image_url: { url: ref.image },
        });
      });
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
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
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
