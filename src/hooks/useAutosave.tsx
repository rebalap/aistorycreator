import { useEffect, useRef, useCallback, useState } from "react";
import { StoryPage } from "@/components/PageThumbnails";
import { TitlePosition, TitleFontStyle, TitleFontSize } from "@/components/CoverPagePreview";
import { useStories } from "@/hooks/useStories";
import { supabase } from "@/integrations/supabase/client";

export interface StoryDraft {
  storyTitle: string;
  characterImages: string[];
  backgroundImages: string[];
  pages: StoryPage[];
  coverImage: string | null;
  coverTitle: string;
  titlePosition: TitlePosition;
  titleFontStyle: TitleFontStyle;
  titleColor: string;
  titleFontSize: TitleFontSize;
  lastSaved: number;
  currentStoryId: string | null;
}

const DRAFT_KEY = "story-draft";
const LOCAL_SAVE_DEBOUNCE = 2000;
const DB_SAVE_INTERVAL = 30000;

interface UseAutosaveProps {
  storyTitle: string;
  characterImages: string[];
  backgroundImages: string[];
  pages: StoryPage[];
  coverImage: string | null;
  coverTitle: string;
  titlePosition: TitlePosition;
  titleFontStyle: TitleFontStyle;
  titleColor: string;
  titleFontSize: TitleFontSize;
  currentStoryId: string | null;
  user: any;
  onRestoreDraft: (draft: StoryDraft) => void;
}

export type AutosaveStatus = "idle" | "saving" | "saved" | "unsaved";

export const useAutosave = ({
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
  onRestoreDraft,
}: UseAutosaveProps) => {
  const { updateStory, saveStoryPages } = useStories();
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [hasDraft, setHasDraft] = useState(false);
  const [draftInfo, setDraftInfo] = useState<{ title: string; lastSaved: Date } | null>(null);
  
  const localSaveTimeout = useRef<NodeJS.Timeout | null>(null);
  const dbSaveInterval = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>("");
  const isInitialized = useRef(false);

  const getCurrentDraft = useCallback((): StoryDraft => ({
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
    lastSaved: Date.now(),
    currentStoryId,
  }), [storyTitle, characterImages, backgroundImages, pages, coverImage, coverTitle, titlePosition, titleFontStyle, titleColor, titleFontSize, currentStoryId]);

  const getDraftHash = useCallback(() => {
    return JSON.stringify({
      storyTitle,
      characterImages,
      backgroundImages,
      pages: pages.map(p => ({ text: p.text, image: p.image })),
      coverImage,
      coverTitle,
      titlePosition,
      titleFontStyle,
      titleColor,
      titleFontSize,
    });
  }, [storyTitle, characterImages, backgroundImages, pages, coverImage, coverTitle, titlePosition, titleFontStyle, titleColor, titleFontSize]);

  // Save to localStorage
  const saveToLocal = useCallback(() => {
    try {
      const draft = getCurrentDraft();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      lastSavedRef.current = getDraftHash();
      setStatus("saved");
    } catch (error) {
      console.error("Failed to save draft to localStorage:", error);
    }
  }, [getCurrentDraft, getDraftHash]);

  // Save to database (only for existing stories)
  const saveToDatabase = useCallback(async () => {
    if (!currentStoryId || !user) return;

    setStatus("saving");
    try {
      // Upload images that are base64
      const uploadImage = async (base64: string, fileName: string): Promise<string> => {
        if (!base64.startsWith("data:")) return base64;
        
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "image/png" });

        const filePath = `${user.id}/${fileName}`;
        await supabase.storage.from("story-images").upload(filePath, blob, { upsert: true });
        const { data: { publicUrl } } = supabase.storage.from("story-images").getPublicUrl(filePath);
        return publicUrl;
      };

      // Upload character image if needed
      let characterImageUrl = characterImages[0] || null;
      if (characterImageUrl?.startsWith("data:")) {
        characterImageUrl = await uploadImage(characterImageUrl, `character-autosave-${Date.now()}.png`);
      }

      // Upload cover image if needed
      let coverImageUrl = coverImage;
      if (coverImageUrl?.startsWith("data:")) {
        coverImageUrl = await uploadImage(coverImageUrl, `cover-autosave-${Date.now()}.png`);
      }

      // Prepare pages
      const pageData = await Promise.all(pages.map(async (page) => {
        let imageUrl = page.image;
        if (imageUrl?.startsWith("data:")) {
          imageUrl = await uploadImage(imageUrl, `page-${page.pageNumber}-autosave-${Date.now()}.png`);
        }
        return {
          page_number: page.pageNumber,
          text: page.text,
          image_url: imageUrl,
        };
      }));

      await updateStory(currentStoryId, {
        title: storyTitle,
        cover_image_url: coverImageUrl,
        character_image_url: characterImageUrl,
        background_image_urls: backgroundImages,
      });
      await saveStoryPages(currentStoryId, pageData);
      
      setStatus("saved");
    } catch (error) {
      console.error("Database autosave failed:", error);
      setStatus("unsaved");
    }
  }, [currentStoryId, user, storyTitle, characterImages, backgroundImages, pages, coverImage, updateStory, saveStoryPages]);

  // Check for existing draft on mount
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draft: StoryDraft = JSON.parse(savedDraft);
        // Only show restore dialog if draft has meaningful content
        const hasContent = draft.pages.some(p => p.text || p.image) || 
                         draft.characterImages.length > 0 || 
                         draft.coverImage;
        
        if (hasContent) {
          setHasDraft(true);
          setDraftInfo({
            title: draft.storyTitle,
            lastSaved: new Date(draft.lastSaved),
          });
        }
      }
    } catch (error) {
      console.error("Failed to check for draft:", error);
    }
  }, []);

  // Debounced local save on state changes
  useEffect(() => {
    const currentHash = getDraftHash();
    if (currentHash === lastSavedRef.current) return;

    setStatus("unsaved");

    if (localSaveTimeout.current) {
      clearTimeout(localSaveTimeout.current);
    }

    localSaveTimeout.current = setTimeout(() => {
      saveToLocal();
    }, LOCAL_SAVE_DEBOUNCE);

    return () => {
      if (localSaveTimeout.current) {
        clearTimeout(localSaveTimeout.current);
      }
    };
  }, [getDraftHash, saveToLocal]);

  // Database autosave interval for saved stories
  useEffect(() => {
    if (!currentStoryId || !user) {
      if (dbSaveInterval.current) {
        clearInterval(dbSaveInterval.current);
      }
      return;
    }

    dbSaveInterval.current = setInterval(() => {
      const currentHash = getDraftHash();
      if (currentHash !== lastSavedRef.current) {
        saveToDatabase();
      }
    }, DB_SAVE_INTERVAL);

    return () => {
      if (dbSaveInterval.current) {
        clearInterval(dbSaveInterval.current);
      }
    };
  }, [currentStoryId, user, getDraftHash, saveToDatabase]);

  // Beforeunload warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const currentHash = getDraftHash();
      if (currentHash !== lastSavedRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [getDraftHash]);

  const restoreDraft = useCallback(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draft: StoryDraft = JSON.parse(savedDraft);
        onRestoreDraft(draft);
        lastSavedRef.current = getDraftHash();
        setHasDraft(false);
        setDraftInfo(null);
      }
    } catch (error) {
      console.error("Failed to restore draft:", error);
    }
  }, [onRestoreDraft, getDraftHash]);

  const discardDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
    setDraftInfo(null);
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    lastSavedRef.current = "";
  }, []);

  return {
    status,
    hasDraft,
    draftInfo,
    restoreDraft,
    discardDraft,
    clearDraft,
    saveToLocal,
  };
};
