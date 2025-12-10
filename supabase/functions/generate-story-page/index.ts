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
    const { characterImage, backgroundImages, storyText } = await req.json();

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

    console.log("Generating story page with text:", storyText.substring(0, 100) + "...");

    // Build the prompt for image generation
    let prompt = `Create a children's book illustration in a square 1:1 aspect ratio that matches the art style, color palette, and illustration technique of the provided character image. `;
    prompt += `The scene should visually depict: "${storyText}". `;
    prompt += `IMPORTANT: Do NOT include any text, words, letters, or captions in the image. The image should be purely visual with no written text whatsoever. `;
    prompt += `The illustration should be in the same whimsical, storybook style as the character reference. `;
    prompt += `Use similar colors, line work, and artistic techniques. `;
    prompt += `The image should be suitable for a children's story book page. `;
    prompt += `Make it warm, inviting, and magical. Output the image in square format with no text.`;

    if (backgroundImages && backgroundImages.length > 0) {
      prompt += ` Also use the provided background reference images to guide the environment, scenery, and color palette.`;
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
          url: characterImage,
        },
      },
    ];

    // Add background images if provided
    if (backgroundImages && backgroundImages.length > 0) {
      backgroundImages.forEach((bgImage: string) => {
        messageContent.push({
          type: "image_url",
          image_url: {
            url: bgImage,
          },
        });
      });
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
          JSON.stringify({ error: "Usage limit reached. Please add credits to continue." }),
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

    console.log("Story page generated successfully");

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
