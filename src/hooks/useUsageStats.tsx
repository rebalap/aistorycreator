import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UsageStats {
  totalGenerations: number;
  storiesWithGenerations: number;
  avgPerStory: number;
  isLoading: boolean;
}

export const useUsageStats = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStats>({
    totalGenerations: 0,
    storiesWithGenerations: 0,
    avgPerStory: 0,
    isLoading: true,
  });

  const fetchStats = useCallback(async () => {
    if (!user) {
      setStats(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const { data, error } = await supabase
        .from("generation_logs")
        .select("story_id")
        .eq("user_id", user.id);

      if (error) throw error;

      const totalGenerations = data?.length || 0;
      const uniqueStories = new Set(
        (data || []).filter(d => d.story_id).map(d => d.story_id)
      );
      const storiesWithGenerations = uniqueStories.size;
      const avgPerStory = storiesWithGenerations > 0
        ? Math.round(totalGenerations / storiesWithGenerations)
        : 0;

      setStats({
        totalGenerations,
        storiesWithGenerations,
        avgPerStory,
        isLoading: false,
      });
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      setStats(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const logGeneration = useCallback(async (
    generationType: "page" | "cover" | "edit_page" | "edit_cover",
    storyId?: string | null
  ) => {
    if (!user) return;

    try {
      await supabase.from("generation_logs").insert({
        user_id: user.id,
        generation_type: generationType,
        story_id: storyId || null,
      });
      
      // Refresh stats after logging
      fetchStats();
    } catch (error) {
      console.error("Error logging generation:", error);
    }
  }, [user, fetchStats]);

  return { ...stats, logGeneration, refreshStats: fetchStats };
};
