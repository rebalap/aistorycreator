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
  background_image_urls: string[] | null;
  created_at: string;
  updated_at: string;
  pages?: StoryPage[];
}

export const useStories = () => {
  const { user } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStories = async () => {
    if (!user) {
      setStories([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("stories")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setStories(data || []);
    } catch (error: any) {
      console.error("Error fetching stories:", error);
      toast.error("Failed to load stories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStories();
  }, [user]);

  // Real-time subscription for concurrent multi-device sync
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('stories-realtime')
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

  const createStory = async (title: string, characterImageUrl?: string, backgroundImageUrls?: string[]) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("stories")
        .insert({
          user_id: user.id,
          title,
          character_image_url: characterImageUrl || null,
          background_image_urls: backgroundImageUrls || null,
        })
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
        .update(updates)
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
    loading,
    fetchStories,
    createStory,
    updateStory,
    deleteStory,
    getStoryWithPages,
    saveStoryPages,
  };
};
