import { cn } from "@/lib/utils";
import { Plus, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface StoryPage {
  id: string;
  pageNumber: number;
  text: string;
  image: string | null;
  pendingImage: string | null;
}

interface PageThumbnailsProps {
  pages: StoryPage[];
  currentPageIndex: number;
  onPageSelect: (index: number) => void;
  onAddPage: () => void;
  maxPages?: number;
  className?: string;
}

export function PageThumbnails({
  pages,
  currentPageIndex,
  onPageSelect,
  onAddPage,
  maxPages = 18,
  className,
}: PageThumbnailsProps) {
  const canAddPage = pages.length < maxPages;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Story Pages ({pages.length}/{maxPages})
        </h3>
        {canAddPage && (
          <Button variant="outline" size="sm" onClick={onAddPage}>
            <Plus className="w-4 h-4 mr-1" />
            Add Page
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {pages.map((page, index) => (
          <button
            key={page.id}
            onClick={() => onPageSelect(index)}
            className={cn(
              "relative w-16 h-16 rounded-lg border-2 overflow-hidden transition-all",
              "hover:ring-2 hover:ring-primary/50",
              currentPageIndex === index
                ? "border-primary ring-2 ring-primary/30"
                : "border-border"
            )}
          >
            {page.image ? (
              <img
                src={page.image}
                alt={`Page ${page.pageNumber}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <span className="text-xs text-muted-foreground font-medium">
                  {page.pageNumber}
                </span>
              </div>
            )}
            {/* Page number badge */}
            <div className="absolute bottom-0 left-0 right-0 bg-background/80 text-center py-0.5">
              <span className="text-[10px] font-medium text-foreground">
                {page.pageNumber}
              </span>
            </div>
          </button>
        ))}

        {/* Add page button inline */}
        {canAddPage && pages.length > 0 && (
          <button
            onClick={onAddPage}
            className={cn(
              "w-16 h-16 rounded-lg border-2 border-dashed border-border",
              "flex items-center justify-center",
              "hover:border-primary hover:bg-accent/50 transition-colors"
            )}
          >
            <Plus className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}
