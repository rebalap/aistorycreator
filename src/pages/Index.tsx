import { useState } from "react";
import { MetadataBar } from "@/components/MetadataBar";
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
      const previousImages = pages
        .filter((_, index) => index < currentPageIndex && pages[index].image)
        .map((page) => page.image!)
        .slice(-3);

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

  // Helper to parse page number from text (handles "1", "one", "two", etc.)
  const parsePageNumber = (text: string): number => {
    const numberWords: Record<string, number> = {
      one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
      nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
      fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    };
    const lower = text.toLowerCase();
    return numberWords[lower] || parseInt(text, 10);
  };

  const handleEditImage = async (editPrompt: string) => {
    if (!currentPage.image) return;

    setIsEditingImage(true);

    try {
      // Parse page references from prompt (e.g., "page 1", "story page 3")
      const pageRefRegex = /(?:story\s+)?page\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen)/gi;
      const matches = [...editPrompt.matchAll(pageRefRegex)];

      // Collect referenced images from other pages
      const referenceImages = matches
        .map((match) => {
          const pageNum = parsePageNumber(match[1]);
          const page = pages[pageNum - 1]; // 0-indexed
          return page;
        })
        .filter((page) => page && page.image && page.id !== currentPage.id)
        .map((page) => ({ pageNumber: page.pageNumber, image: page.image! }));

      const { data, error } = await supabase.functions.invoke("edit-story-image", {
        body: {
          currentImage: currentPage.image,
          editPrompt: editPrompt,
          referenceImages: referenceImages,
          currentPageNumber: currentPage.pageNumber,
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

  const renderPageToBlob = (page: StoryPage): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!page.image) {
        resolve(null);
        return;
      }

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

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
        const targetWidth = imageWidth;
        const targetHeight = height;
        const sourceWidth = img.naturalWidth;
        const sourceHeight = img.naturalHeight;

        const scaleX = targetWidth / sourceWidth;
        const scaleY = targetHeight / sourceHeight;
        const scale = Math.max(scaleX, scaleY);

        const visibleWidth = targetWidth / scale;
        const visibleHeight = targetHeight / scale;

        const offsetX = (sourceWidth - visibleWidth) / 2;
        const offsetY = (sourceHeight - visibleHeight) / 2;

        ctx.drawImage(
          img,
          offsetX, offsetY, visibleWidth, visibleHeight,
          0, 0, targetWidth, targetHeight
        );

        ctx.fillStyle = "#faf8f5";
        ctx.fillRect(imageWidth, 0, textAreaWidth, height);

        ctx.fillStyle = "#1a1a1a";
        ctx.font = "bold 48px Georgia, serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        const maxWidth = textAreaWidth - 80;
        const lineHeight = 64;
        const words = page.text.split(" ");
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

        canvas.toBlob((blob) => resolve(blob), "image/png");
      };

      img.onerror = () => resolve(null);
      img.src = page.image;
    });
  };

  const handleDownload = async () => {
    if (!currentPage.image) return;

    const blob = await renderPageToBlob(currentPage);
    if (!blob) {
      toast.error("Failed to download. Try again.");
      return;
    }

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `story-page-${currentPage.pageNumber}-${Date.now()}.png`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Story page downloaded!");
  };

  const handleDownloadAll = async () => {
    const pagesWithImages = pages.filter((page) => page.image);
    if (pagesWithImages.length === 0) {
      toast.error("No pages with images to download");
      return;
    }

    const loadingToast = toast.loading(`Preparing ${pagesWithImages.length} pages...`);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (const page of pagesWithImages) {
        const blob = await renderPageToBlob(page);
        if (blob) {
          zip.file(`story-page-${page.pageNumber}.png`, blob);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `my-story-${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.dismiss(loadingToast);
      toast.success(`Downloaded ${pagesWithImages.length} pages!`);
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("Failed to create ZIP file");
    }
  };

  const handleReset = () => {
    setCharacterImages([]);
    setBackgroundImages([]);
    setPages([createEmptyPage(1)]);
    setCurrentPageIndex(0);
  };

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent-foreground flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Story Creator</h1>
              <p className="text-xs text-muted-foreground">AI-powered multi-page stories</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              disabled={pages.filter((p) => p.image).length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Download All ({pages.filter((p) => p.image).length})
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 space-y-4">
        {/* Metadata Bar - Character & Background uploads */}
        <MetadataBar
          characterImages={characterImages}
          onCharacterImagesChange={setCharacterImages}
          backgroundImages={backgroundImages}
          onBackgroundImagesChange={setBackgroundImages}
        />

        {/* Page Thumbnails - Full width horizontal */}
        <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
          <PageThumbnails
            pages={pages}
            currentPageIndex={currentPageIndex}
            onPageSelect={setCurrentPageIndex}
            onAddPage={handleAddPage}
            maxPages={18}
          />
        </div>

        {/* Story Page Editor - Two columns */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Left: Page Input */}
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  Page {currentPage.pageNumber} Story Line
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enter text for this page
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
              className="min-h-[140px] resize-none font-serif text-base"
            />
            <Button
              onClick={handleGenerate}
              disabled={
                isGenerating ||
                isEditingImage ||
                currentPage.pendingImage !== null ||
                characterImages.length === 0 ||
                !currentPage.text.trim()
              }
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Page {currentPage.pageNumber}
                </>
              )}
            </Button>
          </div>

          {/* Right: Preview */}
          <div className="space-y-3">
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
                disabled={isEditingImage}
              >
                <Download className="w-4 h-4 mr-2" />
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
