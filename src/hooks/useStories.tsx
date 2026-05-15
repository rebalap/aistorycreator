import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface StoryPage {
  id: string;
  story_id: string;
  page_number: number;
  text: string;
  image_url: string | null;
  text_en?: string | null;
  text_ar?: string | null;
  text_te?: string | null;
}

export interface Story {
  id: string;
  user_id: string;
  title: string;
  cover_image_url: string | null;
  character_image_url?: string | null;
  language?: string;
  background_image_urls?: string[] | null;
  title_en?: string | null;
  title_ar?: string | null;
  title_te?: string | null;
  created_at: string;
  updated_at: string;
  pages?: StoryPage[];
  creator_email?: string;
}

// Lightweight columns needed to render shelf cards
const SHELF_COLUMNS = "id, user_id, title, cover_image_url, updated_at, created_at, language";

interface ShelfData {
  own: Story[];
  community: Story[];
}

export const useStories = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ["shelf-stories", user?.id];

  const fetchShelf = async (): Promise<ShelfData> => {
    if (!user) return { own: [], community: [] };

    const [ownResult, allResult] = await Promise.all([
      supabase
        .from("stories")
        .select(SHELF_COLUMNS)
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("stories")
        .select(SHELF_COLUMNS)
        .neq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(100),
    ]);

    if (ownResult.error) throw ownResult.error;
    if (allResult.error) throw allResult.error;

    const own = (ownResult.data || []) as Story[];
    const community = (allResult.data || []) as Story[];

    // Only fetch profiles for the user_ids we actually display
    const userIds = Array.from(
      new Set([...own.map(s => s.user_id), ...community.map(s => s.user_id)])
    );

    const emailMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", userIds);
      (profiles || []).forEach((p: any) => { emailMap[p.id] = p.email; });
    }

    const enrich = (list: Story[]) =>
      list.map(s => ({ ...s, creator_email: emailMap[s.user_id] || undefined }));

    return { own: enrich(own), community: enrich(community) };
  };

  const query = useQuery<ShelfData>({
    queryKey,
    queryFn: fetchShelf,
    enabled: !!user,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  // Realtime: merge partial updates into the cached shelf data
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`stories-realtime-${user.id}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stories",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          queryClient.setQueryData<ShelfData>(queryKey, (prev) => {
            const current = prev ?? { own: [], community: [] };
            if (payload.eventType === "INSERT") {
              const incoming = payload.new as Story;
              if (current.own.some(s => s.id === incoming.id)) return current;
              return { ...current, own: [incoming, ...current.own] };
            }
            if (payload.eventType === "UPDATE") {
              const incoming = payload.new as Story;
              return {
                ...current,
                own: current.own.map(s =>
                  s.id === incoming.id ? { ...s, ...incoming } : s
                ),
              };
            }
            if (payload.eventType === "DELETE") {
              const removed = payload.old as Story;
              return {
                ...current,
                own: current.own.filter(s => s.id !== removed.id),
              };
            }
            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const stories = query.data?.own ?? [];
  const communityStories = query.data?.community ?? [];

  const setShelf = (updater: (prev: ShelfData) => ShelfData) => {
    queryClient.setQueryData<ShelfData>(queryKey, (prev) =>
      updater(prev ?? { own: [], community: [] })
    );
  };

  const createStory = async (
    title: string,
    characterImageUrl?: string,
    backgroundImageUrls?: string[],
    storyLanguage?: string
  ) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("stories")
        .insert({
          user_id: user.id,
          title,
          character_image_url: characterImageUrl || null,
          background_image_urls: backgroundImageUrls || null,
          language: storyLanguage || "en",
        } as any)
        .select()
        .single();

      if (error) throw error;
      setShelf(prev => ({ ...prev, own: [data as Story, ...prev.own] }));
      return data;
    } catch (error: any) {
      console.error("Error creating story:", error);
      toast.error("Failed to create story");
      return null;
    }
  };

  const updateStory = async (storyId: string, updates: Partial<Story>) => {
    const { data, error } = await supabase
      .from("stories")
      .update(updates as any)
      .eq("id", storyId)
      .select()
      .single();

    if (error) {
      console.error("Error updating story:", error);
      throw error;
    }

    setShelf(prev => ({
      ...prev,
      own: prev.own.map(s => (s.id === storyId ? { ...s, ...(data as Story) } : s)),
    }));
    return data;
  };

  const deleteStory = async (storyId: string) => {
    try {
      const { error } = await supabase.from("stories").delete().eq("id", storyId);
      if (error) throw error;

      setShelf(prev => ({
        ...prev,
        own: prev.own.filter(s => s.id !== storyId),
      }));
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

  const saveStoryPages = async (
    storyId: string,
    pages: {
      page_number: number;
      text: string;
      image_url: string | null;
      text_en?: string | null;
      text_ar?: string | null;
      text_te?: string | null;
    }[]
  ) => {
    const { error: delErr } = await supabase.from("story_pages").delete().eq("story_id", storyId);
    if (delErr) {
      console.error("Error deleting old pages:", delErr);
      throw delErr;
    }

    if (pages.length > 0) {
      const { error } = await supabase
        .from("story_pages")
        .insert(pages.map(p => ({ ...p, story_id: storyId })));

      if (error) {
        console.error("Error inserting pages:", error);
        throw error;
      }
    }

    return true;
  };

  return {
    stories,
    communityStories,
    loading: query.isLoading,
    error: query.error ? "Unable to load stories. Please check your connection and try again." : null,
    fetchStories: () => query.refetch(),
    retryFetch: () => query.refetch(),
    createStory,
    updateStory,
    deleteStory,
    getStoryWithPages,
    saveStoryPages,
  };
};
