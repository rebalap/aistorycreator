import { useState } from "react";
import { ImageUploader } from "@/components/ImageUploader";
import { StoryPagePreview } from "@/components/StoryPagePreview";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [characterImages, setCharacterImages] = useState<string[]>([]);
  const [backgroundImages, setBackgroundImages] = useState<string[]>([]);
  const [storyText, setStoryText] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);

  const handleGenerate = async () => {
    if (characterImages.length === 0) {
      toast.error("Please upload a character image first");
      return;
    }
    if (!storyText.trim()) {
      toast.error("Please enter a story line");
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-story-page", {
        body: {
          characterImage: characterImages[0],
          backgroundImages: backgroundImages,
          storyText: storyText.trim(),
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to generate story page");
      }

      if (data?.image) {
        setGeneratedImage(data.image);
        toast.success("Story page generated successfully!");
      } else {
        throw new Error("No image received from the server");
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      toast.error(error.message || "Failed to generate story page. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditImage = async (editPrompt: string) => {
    if (!generatedImage) return;

    setIsEditingImage(true);

    try {
      const { data, error } = await supabase.functions.invoke("edit-story-image", {
        body: {
          currentImage: generatedImage,
          editPrompt: editPrompt,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to edit image");
      }

      if (data?.image) {
        setGeneratedImage(data.image);
        toast.success("Image edited successfully!");
      } else {
        throw new Error("No edited image received");
      }
    } catch (error: any) {
      console.error("Edit error:", error);
      toast.error(error.message || "Failed to edit image. Please try again.");
    } finally {
      setIsEditingImage(false);
    }
  };

  const handleDownload = async () => {
    if (!generatedImage) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 1920;
    const height = 1080;
    canvas.width = width;
    canvas.height = height;

    const imageWidth = width / 2;
    const textAreaWidth = width / 2;

    ctx.fillStyle = "#faf8f5";
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      ctx.drawImage(img, 0, 0, imageWidth, height);

      ctx.fillStyle = "#faf8f5";
      ctx.fillRect(imageWidth, 0, textAreaWidth, height);

      ctx.fillStyle = "#1a1a1a";
      ctx.font = "bold 48px Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const maxWidth = textAreaWidth - 80;
      const lineHeight = 64;
      const words = storyText.split(" ");
      const lines: string[] = [];
      let currentLine = "";

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      const totalTextHeight = lines.length * lineHeight;
      const startY = (height - totalTextHeight) / 2 + lineHeight / 2;
      const centerX = imageWidth + textAreaWidth / 2;

      lines.forEach((line, index) => {
        ctx.fillText(line, centerX, startY + index * lineHeight);
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `story-page-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Story page downloaded!");
    };

    img.onerror = () => {
      toast.error("Failed to download. Try again.");
    };

    img.src = generatedImage;
  };

  const handleReset = () => {
    setCharacterImages([]);
    setBackgroundImages([]);
    setStoryText("");
    setGeneratedImage(null);
  };

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-accent-foreground flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Story Creator</h1>
              <p className="text-xs text-muted-foreground">AI-powered story page generator</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
              <ImageUploader
                label="Character Image"
                description="Upload the main character illustration. The AI will match its style and color palette."
                images={characterImages}
                onImagesChange={setCharacterImages}
              />
            </div>

            <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
              <ImageUploader
                label="Background References (Optional)"
                description="Upload reference images to guide the background style and color palette."
                multiple
                images={backgroundImages}
                onImagesChange={setBackgroundImages}
              />
            </div>

            <div className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">Story Line</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter the text that will appear on this story page
                </p>
              </div>
              <Textarea
                value={storyText}
                onChange={(e) => setStoryText(e.target.value)}
                placeholder="Once upon a time, in a magical forest..."
                className="min-h-[120px] resize-none font-serif text-base"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={isGenerating || isEditingImage || characterImages.length === 0 || !storyText.trim()}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Story Page
                </>
              )}
            </Button>
          </div>

          <div className="space-y-6">
            <StoryPagePreview
              image={generatedImage}
              text={storyText}
              isLoading={isGenerating}
              isEditingImage={isEditingImage}
              onEditImage={generatedImage ? handleEditImage : undefined}
              onTextChange={setStoryText}
            />

            {generatedImage && (
              <Button
                onClick={handleDownload}
                variant="outline"
                className="w-full"
                size="lg"
                disabled={isEditingImage}
              >
                <Download className="w-5 h-5 mr-2" />
                Download Story Page
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Index;
