import { Sparkles } from "lucide-react";

interface UsageStatsProps {
  totalGenerations: number;
  avgPerStory: number;
  isLoading: boolean;
}

export const UsageStats = ({ totalGenerations, avgPerStory, isLoading }: UsageStatsProps) => {
  if (isLoading) return null;
  
  // Don't show if no generations yet
  if (totalGenerations === 0) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Sparkles className="w-3 h-3" />
      <span>{totalGenerations} generations</span>
      {avgPerStory > 0 && (
        <>
          <span className="opacity-50">•</span>
          <span>~{avgPerStory}/story</span>
        </>
      )}
    </div>
  );
};
