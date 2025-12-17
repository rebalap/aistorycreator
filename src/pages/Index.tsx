import { useState, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MetadataBar } from "@/components/MetadataBar";
import { StoryPagePreview } from "@/components/StoryPagePreview";
import { PageThumbnails, StoryPage } from "@/components/PageThumbnails";
import { SaveStoryDialog } from "@/components/SaveStoryDialog";
import { CoverPagePreview, TitlePosition, TitleFontStyle, TitleFontSize } from "@/components/CoverPagePreview";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sparkles, Download, RefreshCw, Trash2, Save, BookOpen, LogIn, LogOut, Loader2, Cloud, CloudOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStories } from "@/hooks/useStories";
import { useAutosave, StoryDraft } from "@/hooks/useAutosave";

const createEmptyPage = (pageNumber: number): StoryPage => ({
  id: crypto.randomUUID(),
  pageNumber,
  text: "",
  image: null,
  pendingImage: null,
});

const Index = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storyId = searchParams.get("story");
  
  const { user, signOut, loading: authLoading } = useAuth();
  const { createStory, updateStory, getStoryWithPages, saveStoryPages } = useStories();

  const [characterImages, setCharacterImages] = useState<string[]>([]);
  const [backgroundImages, setBackgroundImages] = useState<string[]>([]);
  const [pages, setPages] = useState<StoryPage[]>([createEmptyPage(1)]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isCoverSelected, setIsCoverSelected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditingImage, setIsEditingImage] = useState(false);
  
  const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);
  const [storyTitle, setStoryTitle] = useState("Untitled Story");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingStory, setIsLoadingStory] = useState(false);

  // Cover page state
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [pendingCoverImage, setPendingCoverImage] = useState<string | null>(null);
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const [isEditingCover, setIsEditingCover] = useState(false);
  const [coverTitle, setCoverTitle] = useState<string>("Untitled Story");
  const [titlePosition, setTitlePosition] = useState<TitlePosition>('center');
  const [titleFontStyle, setTitleFontStyle] = useState<TitleFontStyle>('classic');
  const [titleColor, setTitleColor] = useState<string>('#FFFFFF');
  const [titleFontSize, setTitleFontSize] = useState<TitleFontSize>('medium');

  // Restore draft callback
  const handleRestoreDraft = useCallback((draft: StoryDraft) => {
    setStoryTitle(draft.storyTitle);
    setCharacterImages(draft.characterImages);
    setBackgroundImages(draft.backgroundImages);
    setPages(draft.pages);
    setCoverImage(draft.coverImage);
    setCoverTitle(draft.coverTitle);
    setTitlePosition(draft.titlePosition);
    setTitleFontStyle(draft.titleFontStyle);
    setTitleColor(draft.titleColor);
    setTitleFontSize(draft.titleFontSize);
    if (draft.currentStoryId) {
      setCurrentStoryId(draft.currentStoryId);
    }
    toast.success("Draft restored!");
  }, []);

  // Autosave hook
  const {
    status: autosaveStatus,
    clearDraft,
  } = useAutosave({
    storyTitle,
    characterImages,
    backgroundImages,
    pages,
    coverImage,
    coverTitle,
    titlePosition,
    titleFontStyle,
    titleColor,
    titleFontSize,
    currentStoryId,
    user,
    onRestoreDraft: handleRestoreDraft,
  });

  const currentPage = pages[currentPageIndex];

  // Redirect unauthenticated users to auth page
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  // Load story from URL param
  useEffect(() => {
    if (storyId && user) {
      loadStory(storyId);
    }
  }, [storyId, user]);

  const loadStory = async (id: string) => {
    setIsLoadingStory(true);
    const result = await getStoryWithPages(id);
    
    if (result) {
      const { story, pages: loadedPages } = result;
      setCurrentStoryId(story.id);
      setStoryTitle(story.title);
      setCharacterImages(story.character_image_url ? [story.character_image_url] : []);
      setBackgroundImages(story.background_image_urls || []);
      setCoverImage(story.cover_image_url || null);
      setCoverTitle(story.title);
      
      if (loadedPages.length > 0) {
        setPages(loadedPages.map(p => ({
          id: p.id,
          pageNumber: p.page_number,
          text: p.text,
          image: p.image_url,
          pendingImage: null,
        })));
      } else {
        setPages([createEmptyPage(1)]);
      }
      setCurrentPageIndex(0);
    }
    setIsLoadingStory(false);
  };

  const uploadImageToStorage = async (base64Image: string, fileName: string): Promise<string | null> => {
    if (!user) return null;
    
    try {
      // Convert base64 to blob
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/png" });

      const filePath = `${user.id}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("story-images")
        .upload(filePath, blob, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("story-images")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      return null;
    }
  };

  const handleSaveStory = async (title: string) => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setIsSaving(true);

    try {
      // Upload character image if it's base64
      let characterImageUrl = characterImages[0] || null;
      if (characterImageUrl && characterImageUrl.startsWith("data:")) {
        const uploaded = await uploadImageToStorage(characterImageUrl, `character-${Date.now()}.png`);
        if (uploaded) characterImageUrl = uploaded;
      }

      // Upload page images
      const pageDataForSave = [];
      for (const page of pages) {
        let imageUrl = page.image;
        if (imageUrl && imageUrl.startsWith("data:")) {
          const uploaded = await uploadImageToStorage(imageUrl, `page-${page.pageNumber}-${Date.now()}.png`);
          if (uploaded) imageUrl = uploaded;
        }
        pageDataForSave.push({
          page_number: page.pageNumber,
          text: page.text,
          image_url: imageUrl,
        });
      }

      // Upload cover image if it's base64
      let coverImageUrl = coverImage;
      if (coverImageUrl && coverImageUrl.startsWith("data:")) {
        const uploaded = await uploadImageToStorage(coverImageUrl, `cover-${Date.now()}.png`);
        if (uploaded) coverImageUrl = uploaded;
      }

      if (currentStoryId) {
        // Update existing story
        await updateStory(currentStoryId, {
          title,
          cover_image_url: coverImageUrl,
          character_image_url: characterImageUrl,
          background_image_urls: backgroundImages,
        });
        await saveStoryPages(currentStoryId, pageDataForSave);
        setStoryTitle(title);
        toast.success("Story saved!");
      } else {
        // Create new story
        const newStory = await createStory(title, characterImageUrl || undefined, backgroundImages.length > 0 ? backgroundImages : undefined);
        if (newStory) {
          await updateStory(newStory.id, { cover_image_url: coverImageUrl });
          await saveStoryPages(newStory.id, pageDataForSave);
          setCurrentStoryId(newStory.id);
          setStoryTitle(title);
          toast.success("Story saved!");
        }
      }
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error("Failed to save story");
    } finally {
      setIsSaving(false);
      setShowSaveDialog(false);
    }
  };

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
      const pageRefRegex = /(?:story\s+)?page\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen)/gi;
      const matches = [...editPrompt.matchAll(pageRefRegex)];

      const referenceImages = matches
        .map((match) => {
          const pageNum = parsePageNumber(match[1]);
          const page = pages[pageNum - 1];
          return page;
        })
        .filter((page) => page && page.image && page.id !== currentPage.id)
        .map((page) => ({ pageNumber: page.pageNumber, image: page.image! }));

      const mentionsProtagonist = /\bprotagonist\b/gi.test(editPrompt);

      const { data, error } = await supabase.functions.invoke("edit-story-image", {
        body: {
          currentImage: currentPage.image,
          editPrompt: editPrompt,
          referenceImages: referenceImages,
          currentPageNumber: currentPage.pageNumber,
          characterImage: mentionsProtagonist && characterImages.length > 0 ? characterImages[0] : undefined,
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

  // Cover page handlers
  const handleGenerateCover = async () => {
    if (characterImages.length === 0) {
      toast.error("Please upload a character image first");
      return;
    }
    if (!storyTitle.trim() || storyTitle === "Untitled Story") {
      toast.error("Please enter a story title first");
      return;
    }

    setIsGeneratingCover(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-cover-page", {
        body: {
          characterImage: characterImages[0],
          title: storyTitle.trim(),
          backgroundImages: backgroundImages,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to generate cover");
      }

      if (data?.image) {
        setCoverImage(data.image);
        toast.success("Cover generated!");
      } else {
        throw new Error("No cover image received");
      }
    } catch (error: any) {
      console.error("Cover generation error:", error);
      toast.error(error.message || "Failed to generate cover. Please try again.");
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const handleEditCover = async (editPrompt: string) => {
    if (!coverImage) return;

    setIsEditingCover(true);

    try {
      const { data, error } = await supabase.functions.invoke("edit-cover-image", {
        body: {
          currentImage: coverImage,
          editPrompt: editPrompt,
          characterImage: characterImages.length > 0 ? characterImages[0] : undefined,
          title: storyTitle,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to edit cover");
      }

      if (data?.image) {
        setPendingCoverImage(data.image);
        toast.success("Cover edit complete! Compare and choose.");
      } else {
        throw new Error("No edited cover received");
      }
    } catch (error: any) {
      console.error("Cover edit error:", error);
      toast.error(error.message || "Failed to edit cover. Please try again.");
    } finally {
      setIsEditingCover(false);
    }
  };

  const handleAcceptCover = () => {
    if (pendingCoverImage) {
      setCoverImage(pendingCoverImage);
      setPendingCoverImage(null);
      toast.success("New cover accepted!");
    }
  };

  const handleDiscardCover = () => {
    setPendingCoverImage(null);
    toast.info("Cover edit discarded, keeping original.");
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

  const renderCoverToBlob = async (): Promise<Blob | null> => {
    if (!coverImage) return null;

    // Font mapping for canvas
    const fontMapping: Record<TitleFontStyle, string> = {
      classic: '"Playfair Display", serif',
      modern: '"Inter", sans-serif',
      playful: '"Lobster", cursive',
      bold: '"Bebas Neue", sans-serif',
      comic: '"Comic Neue", cursive'
    };

    // Font size mapping for canvas
    const fontSizeMapping: Record<TitleFontSize, number> = {
      small: 50,
      medium: 80,
      large: 120
    };

    const fontSize = fontSizeMapping[titleFontSize];
    const fontFamily = fontMapping[titleFontStyle];

    // Wait for all fonts to be ready first
    await document.fonts.ready;
    
    // Then specifically load the font we need with the actual size
    try {
      await document.fonts.load(`bold ${fontSize}px ${fontFamily}`);
    } catch (e) {
      console.warn("Font preload failed, using fallback");
    }

    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);

      const width = 1920;
      const height = 1080;
      canvas.width = width;
      canvas.height = height;

      const img = new Image();
      img.crossOrigin = "anonymous";

      img.onload = async () => {
        // Wait for fonts again inside callback to ensure they're ready
        await document.fonts.ready;
        // Draw cover image with object-cover behavior
        const imgAspect = img.width / img.height;
        const canvasAspect = width / height;

        let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

        if (imgAspect > canvasAspect) {
          // Image is wider - crop horizontally
          sWidth = img.height * canvasAspect;
          sx = (img.width - sWidth) / 2;
        } else {
          // Image is taller - crop vertically
          sHeight = img.width / canvasAspect;
          sy = (img.height - sHeight) / 2;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, width, height);

        // Position mapping for Y coordinate
        const positionY: Record<TitlePosition, number> = {
          top: height * 0.15,
          center: height / 2,
          bottom: height * 0.85
        };

        // Color config based on luminance
        const isLightColor = (hex: string): boolean => {
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          return luminance > 0.5;
        };

        const colorConfig = isLightColor(titleColor) 
          ? { fill: titleColor } 
          : { fill: titleColor, stroke: "#ffffff", strokeWidth: 4 };

        // Draw title text
        ctx.font = `bold ${fontSize}px ${fontFamily}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        if (colorConfig.stroke) {
          // Draw stroke first for black-outline
          ctx.strokeStyle = colorConfig.stroke;
          ctx.lineWidth = colorConfig.strokeWidth || 4;
          ctx.lineJoin = "round";
          ctx.strokeText(coverTitle, width / 2, positionY[titlePosition]);
          // Then fill
          ctx.fillStyle = colorConfig.fill;
          ctx.fillText(coverTitle, width / 2, positionY[titlePosition]);
        } else {
          ctx.fillStyle = colorConfig.fill;
          ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
          ctx.shadowBlur = 15;
          ctx.shadowOffsetX = 3;
          ctx.shadowOffsetY = 3;
          ctx.fillText(coverTitle, width / 2, positionY[titlePosition]);
        }

        canvas.toBlob((blob) => resolve(blob), "image/png");
      };

      img.onerror = () => resolve(null);
      img.src = coverImage;
    });
  };

  const handleDownloadCover = async () => {
    if (!coverImage) return;

    try {
      const blob = await renderCoverToBlob();
      if (!blob) {
        toast.error("Failed to download cover");
        return;
      }

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${storyTitle || "cover"}-cover-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success("Cover downloaded!");
    } catch (error) {
      toast.error("Failed to download cover");
    }
  };

  const handleDownloadAll = async () => {
    const pagesWithImages = pages.filter((page) => page.image);
    const hasCover = !!coverImage;
    const totalItems = pagesWithImages.length + (hasCover ? 1 : 0);
    
    if (totalItems === 0) {
      toast.error("No pages or cover to download");
      return;
    }

    const loadingToast = toast.loading(`Preparing ${totalItems} items...`);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Add cover image first (as 00-cover.png) with title composited
      if (coverImage) {
        const coverBlob = await renderCoverToBlob();
        if (coverBlob) {
          zip.file("00-cover.png", coverBlob);
        }
      }

      // Add story pages
      for (const page of pagesWithImages) {
        const blob = await renderPageToBlob(page);
        if (blob) {
          zip.file(`${String(page.pageNumber).padStart(2, '0')}-page-${page.pageNumber}.png`, blob);
        }
      }

      const content = await zip.generateAsync({ type: "blob" });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `${storyTitle || "my-story"}-${Date.now()}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.dismiss(loadingToast);
      toast.success(`Downloaded ${totalItems} items!`);
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
    setCurrentStoryId(null);
    setStoryTitle("Untitled Story");
    setCoverTitle("Untitled Story");
    setCoverImage(null);
    setPendingCoverImage(null);
    clearDraft();
    navigate("/", { replace: true });
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (authLoading || isLoadingStory) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent-foreground flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="flex-1">
              <Input
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
                className="text-lg font-bold border-none bg-transparent p-0 h-auto focus-visible:ring-0"
                placeholder="Story Title"
              />
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">AI-powered multi-page stories</p>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs flex items-center gap-1">
                  {autosaveStatus === "saving" && (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">Saving...</span>
                    </>
                  )}
                  {autosaveStatus === "saved" && (
                    <>
                      <Cloud className="w-3 h-3 text-green-500" />
                      <span className="text-green-500">Saved</span>
                    </>
                  )}
                  {autosaveStatus === "unsaved" && (
                    <>
                      <CloudOff className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Unsaved</span>
                    </>
                  )}
                  {autosaveStatus === "idle" && (
                    <>
                      <Cloud className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Ready</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/shelf")}
              >
                <BookOpen className="w-4 h-4 mr-2" />
                My Shelf
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (currentStoryId) {
                  handleSaveStory(storyTitle);
                } else {
                  setShowSaveDialog(true);
                }
              }}
              disabled={!user || isSaving}
              title={!user ? "Sign in to save stories" : undefined}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              disabled={pages.filter((p) => p.image).length === 0 && !coverImage}
            >
              <Download className="w-4 h-4 mr-2" />
              Download All ({pages.filter((p) => p.image).length + (coverImage ? 1 : 0)})
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            {authLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : user ? (
              <Button variant="ghost" size="icon" onClick={handleSignOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            )}
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
            onPageSelect={(index) => {
              setIsCoverSelected(false);
              setCurrentPageIndex(index);
            }}
            onAddPage={handleAddPage}
            maxPages={18}
            coverImage={coverImage}
            onCoverSelect={() => setIsCoverSelected(true)}
            isCoverSelected={isCoverSelected}
          />
        </div>

        {/* Editor Section - Two columns */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Left: Input/Controls */}
          <div className="bg-card rounded-xl p-4 border border-border shadow-sm space-y-3">
            {isCoverSelected ? (
              // Cover Page Controls
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Cover Page</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      16:9 book cover with title
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 py-4">
                  <p className="text-sm text-muted-foreground">
                    The cover uses your story title: <span className="font-medium text-foreground">"{storyTitle}"</span>
                  </p>
                </div>
                <Button
                  onClick={handleGenerateCover}
                  disabled={
                    isGeneratingCover ||
                    isEditingCover ||
                    pendingCoverImage !== null ||
                    characterImages.length === 0 ||
                    !storyTitle.trim() ||
                    storyTitle === "Untitled Story"
                  }
                  className="w-full"
                  size="lg"
                >
                  {isGeneratingCover ? (
                    <>
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                      {coverImage ? "Regenerating..." : "Generating..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      {coverImage ? "Regenerate Cover" : "Generate Cover"}
                    </>
                  )}
                </Button>
              </>
            ) : (
              // Story Page Controls
              <>
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
              </>
            )}
          </div>

          {/* Right: Preview */}
          <div className="space-y-3">
            {isCoverSelected ? (
              // Cover Page Preview
              <>
              <CoverPagePreview
                coverImage={coverImage}
                pendingCoverImage={pendingCoverImage}
                title={storyTitle}
                coverTitle={coverTitle}
                isGenerating={isGeneratingCover}
                isEditing={isEditingCover}
                canGenerate={characterImages.length > 0 && storyTitle.trim() !== "" && storyTitle !== "Untitled Story"}
                hasCharacterImage={characterImages.length > 0}
                onGenerate={handleGenerateCover}
                onEdit={handleEditCover}
                onAccept={handleAcceptCover}
                onDiscard={handleDiscardCover}
                onTitleChange={setCoverTitle}
                titlePosition={titlePosition}
                titleFontStyle={titleFontStyle}
                titleColor={titleColor}
                titleFontSize={titleFontSize}
                onPositionChange={setTitlePosition}
                onFontStyleChange={setTitleFontStyle}
                onColorChange={setTitleColor}
                onFontSizeChange={setTitleFontSize}
              />
                {coverImage && !pendingCoverImage && (
                  <Button
                    onClick={handleDownloadCover}
                    variant="outline"
                    className="w-full"
                    disabled={isEditingCover}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Cover
                  </Button>
                )}
              </>
            ) : (
              // Story Page Preview
              <>
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
              </>
            )}
          </div>
        </div>
      </div>

      <SaveStoryDialog
        open={showSaveDialog}
        onOpenChange={setShowSaveDialog}
        onSave={handleSaveStory}
        defaultTitle={storyTitle}
        isSaving={isSaving}
      />

    </main>
  );
};

export default Index;
