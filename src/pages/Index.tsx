import { useState } from "react";
import { ImageUploader } from "@/components/ImageUploader";
import { StoryPagePreview } from "@/components/StoryPagePreview";
import { PageThumbnails, StoryPage } from "@/components/PageThumbnails";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Download, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const createEmptyPage = (pageNumber: number): StoryPage => ({
  id: crypto.randomUUID(),
  pageNumber,
  text: "",
  image: null,
  pendingImage: null,
});

const Index = () => {
  const [characterImages, setCharacterImages] = useState<string[]>([]);
  const [backgroundImages, setBackgroundImages] = useState<string[]>([]);
  const [pages, setPages] = useState<StoryPage[]>([createEmptyPage(1)]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);

  const currentPage = pages[currentPageIndex];

  const updateCurrentPage = (updates: Partial<StoryPage>) => {
    setPages((prev) =>
      prev.map((page, index) =>
        index === currentPageIndex ? { ...page, ...updates } : page
      )
    );
  };

  const handleAddPage = () => {
    if (pages.length >= 18) {
      toast.error("Maximum 18 pages allowed");
      return;
    }
    const newPage = createEmptyPage(pages.length + 1);
    setPages((prev) => [...prev, newPage]);
    setCurrentPageIndex(pages.length);
    toast.success(`Page ${pages.length + 1} added`);
  };

  const handleDeletePage = () => {
    if (pages.length === 1) {
      toast.error("Cannot delete the only page");
      return;
    }
    setPages((prev) => {
      const newPages = prev.filter((_, index) => index !== currentPageIndex);
      // Renumber pages
      return newPages.map((page, index) => ({ ...page, pageNumber: index + 1 }));
    });
    setCurrentPageIndex((prev) => Math.max(0, prev - 1));
    toast.success("Page deleted");
  };

  const handleGenerate = async () => {
    if (characterImages.length === 0) {
      toast.error("Please upload a character image first");
      return;
    }
    if (!currentPage.text.trim()) {
      toast.error("Please enter a story line for this page");
      return;
    }

    setIsGenerating(true);
    updateCurrentPage({ image: null, pendingImage: null });

    try {
      // Collect previous images for character consistency
      const previousImages = pages
        .filter((_, index) => index < currentPageIndex && pages[index].image)
        .map((page) => page.image!)
        .slice(-3); // Use last 3 pages for context

      const { data, error } = await supabase.functions.invoke("generate-story-page", {
        body: {
          characterImage: characterImages[0],
          backgroundImages: backgroundImages,
          storyText: currentPage.text.trim(),
          previousImages: previousImages,
          pageNumber: currentPage.pageNumber,
          totalPages: pages.length,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to generate story page");
      }

      if (data?.image) {
        updateCurrentPage({ image: data.image });
        toast.success(`Page ${currentPage.pageNumber} generated!`);
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
    if (!currentPage.image) return;

    setIsEditingImage(true);

    try {
      const { data, error } = await supabase.functions.invoke("edit-story-image", {
        body: {
          currentImage: currentPage.image,
          editPrompt: editPrompt,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to edit image");
      }

      if (data?.image) {
        updateCurrentPage({ pendingImage: data.image });
        toast.success("Edit complete! Compare and choose.");
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

  const handleAcceptImage = () => {
    if (currentPage.pendingImage) {
      updateCurrentPage({ image: currentPage.pendingImage, pendingImage: null });
      toast.success("New image accepted!");
    }
  };

  const handleDiscardImage = () => {
    updateCurrentPage({ pendingImage: null });
    toast.info("Edit discarded, keeping original.");
  };

  const handleTextChange = (newText: string) => {
    updateCurrentPage({ text: newText });
  };

  const handleDownload = async () => {
    if (!currentPage.image) return;

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
      const words = currentPage.text.split(" ");
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
      link.download = `story-page-${currentPage.pageNumber}-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Story page downloaded!");
    };

    img.onerror = () => {
      toast.error("Failed to download. Try again.");
    };

    img.src = currentPage.image;
  };

  const handleReset = () => {
    setCharacterImages([]);
    setBackgroundImages([]);
    setPages([createEmptyPage(1)]);
    setCurrentPageIndex(0);
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
              <p className="text-xs text-muted-foreground">AI-powered multi-page story generator</p>
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
                description="Upload the main character illustration. The AI will maintain character consistency across all pages."
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

            {/* Page Navigation */}
            <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
              <PageThumbnails
                pages={pages}
                currentPageIndex={currentPageIndex}
                onPageSelect={setCurrentPageIndex}
                onAddPage={handleAddPage}
                maxPages={18}
              />
            </div>

            <div className="bg-card rounded-xl p-6 border border-border shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    Page {currentPage.pageNumber} Story Line
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the text that will appear on this page
                  </p>
                </div>
                {pages.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeletePage}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
              <Textarea
                value={currentPage.text}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Once upon a time, in a magical forest..."
                className="min-h-[120px] resize-none font-serif text-base"
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                isEditingImage ||
                currentPage.pendingImage !== null ||
                characterImages.length === 0 ||
                !currentPage.text.trim()
              }
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Generating Page {currentPage.pageNumber}...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Page {currentPage.pageNumber}
                </>
              )}
            </Button>
          </div>

          <div className="space-y-6">
            <StoryPagePreview
              image={currentPage.image}
              pendingImage={currentPage.pendingImage}
              text={currentPage.text}
              isLoading={isGenerating}
              isEditingImage={isEditingImage}
              onEditImage={currentPage.image && !currentPage.pendingImage ? handleEditImage : undefined}
              onAcceptImage={handleAcceptImage}
              onDiscardImage={handleDiscardImage}
              onTextChange={handleTextChange}
            />

            {currentPage.image && !currentPage.pendingImage && (
              <Button
                onClick={handleDownload}
                variant="outline"
                className="w-full"
                size="lg"
                disabled={isEditingImage}
              >
                <Download className="w-5 h-5 mr-2" />
                Download Page {currentPage.pageNumber}
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default Index;
