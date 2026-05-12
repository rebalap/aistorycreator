import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface StoryPage {
  id: string;
  story_id: string;
  page_number: number;
  text: string;
  image_url: string | null;
}

export interface Story {
  id: string;
  user_id: string;
  title: string;
  cover_image_url: string | null;
  character_image_url: string | null;
  language?: string;
  background_image_urls: string[] | null;
  created_at: string;
  updated_at: string;
  pages?: StoryPage[];
  creator_email?: string;
}

export const useStories = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [communityStories, setCommunityStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStories = async (attempt = 0): Promise<void> => {
    if (!user) {
      setStories([]);
      setCommunityStories([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setError(null);
      const [ownResult, allResult, profilesResult] = await Promise.all([
        supabase
          .from("stories")
          .select("*")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("stories")
          .select("*")
          .neq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("id, email"),
      ]);

      if (ownResult.error) {
        if (attempt < 3 && (ownResult.error.code === "PGRST002" || ownResult.error.message?.includes("503"))) {
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          return fetchStories(attempt + 1);
        }
        throw ownResult.error;
      }
      if (allResult.error) throw allResult.error;

      const emailMap: Record<string, string> = {};
      (profilesResult.data || []).forEach((p: any) => { emailMap[p.id] = p.email; });

      const enrichWithEmail = (stories: any[]) =>
        stories.map(s => ({ ...s, creator_email: emailMap[s.user_id] || undefined }));

      setStories(enrichWithEmail(ownResult.data || []));
      setCommunityStories(enrichWithEmail(allResult.data || []));
    } catch (err: any) {
      console.error("Error fetching stories:", err);
      setError("Unable to load stories. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const retryFetch = () => {
    setLoading(true);
    setError(null);
    fetchStories();
  };

  useEffect(() => {
    fetchStories();
  }, [user]);

  // Real-time subscription for concurrent multi-device sync
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`stories-realtime-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stories',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setStories(prev => {
              const exists = prev.some(s => s.id === (payload.new as Story).id);
              if (exists) return prev;
              return [payload.new as Story, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            setStories(prev => prev.map(s => 
              s.id === (payload.new as Story).id ? payload.new as Story : s
            ));
          } else if (payload.eventType === 'DELETE') {
            setStories(prev => prev.filter(s => s.id !== (payload.old as Story).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const createStory = async (title: string, characterImageUrl?: string, backgroundImageUrls?: string[], storyLanguage?: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("stories")
        .insert({
          user_id: user.id,
          title,
          character_image_url: characterImageUrl || null,
          background_image_urls: backgroundImageUrls || null,
          language: storyLanguage || 'en',
        } as any)
        .select()
        .single();

      if (error) throw error;
      
      setStories(prev => [data, ...prev]);
      return data;
    } catch (error: any) {
      console.error("Error creating story:", error);
      toast.error("Failed to create story");
      return null;
    }
  };

  const updateStory = async (storyId: string, updates: Partial<Story>) => {
    try {
      const { data, error } = await supabase
        .from("stories")
        .update(updates as any)
        .eq("id", storyId)
        .select()
        .single();

      if (error) throw error;
      
      setStories(prev => prev.map(s => s.id === storyId ? data : s));
      return data;
    } catch (error: any) {
      console.error("Error updating story:", error);
      toast.error("Failed to update story");
      return null;
    }
  };

  const deleteStory = async (storyId: string) => {
    try {
      const { error } = await supabase
        .from("stories")
        .delete()
        .eq("id", storyId);

      if (error) throw error;
      
      setStories(prev => prev.filter(s => s.id !== storyId));
      toast.success("Story deleted");
      return true;
    } catch (error: any) {
      console.error("Error deleting story:", error);
      toast.error("Failed to delete story");
      return false;
    }
  };

  const getStoryWithPages = async (storyId: string) => {
    try {
      const [storyResult, pagesResult] = await Promise.all([
        supabase.from("stories").select("*").eq("id", storyId).single(),
        supabase.from("story_pages").select("*").eq("story_id", storyId).order("page_number"),
      ]);

      if (storyResult.error) throw storyResult.error;
      if (pagesResult.error) throw pagesResult.error;

      return { story: storyResult.data, pages: pagesResult.data || [] };
    } catch (error: any) {
      console.error("Error fetching story:", error);
      toast.error("Failed to load story");
      return null;
    }
  };

  const saveStoryPages = async (storyId: string, pages: { page_number: number; text: string; image_url: string | null }[]) => {
    try {
      // Delete existing pages
      await supabase.from("story_pages").delete().eq("story_id", storyId);

      // Insert new pages
      if (pages.length > 0) {
        const { error } = await supabase
          .from("story_pages")
          .insert(pages.map(p => ({ ...p, story_id: storyId })));

        if (error) throw error;
      }

      return true;
    } catch (error: any) {
      console.error("Error saving pages:", error);
      toast.error("Failed to save pages");
      return false;
    }
  };

  return {
    stories,
    communityStories,
    loading,
    error,
    fetchStories,
    retryFetch,
    createStory,
    updateStory,
    deleteStory,
    getStoryWithPages,
    saveStoryPages,
  };
};
