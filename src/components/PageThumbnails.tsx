import { cn } from "@/lib/utils";
import { Plus, BookOpen, ImageIcon } from "lucide-react";

export interface StoryPage {
  id: string;
  pageNumber: number;
  text: string;
  image: string | null;
  pendingImage: string | null;
  /** Cached translations of `text` per language. The currently displayed text is also mirrored under translations[currentLanguage]. */
  translations?: { en?: string | null; ar?: string | null; te?: string | null };
}

interface PageThumbnailsProps {
  pages: StoryPage[];
  currentPageIndex: number;
  onPageSelect: (index: number) => void;
  onAddPage: () => void;
  maxPages?: number;
  className?: string;
  coverImage?: string | null;
  onCoverSelect?: () => void;
  isCoverSelected?: boolean;
}

export function PageThumbnails({
  pages,
  currentPageIndex,
  onPageSelect,
  onAddPage,
  maxPages = 18,
  className,
  coverImage,
  onCoverSelect,
  isCoverSelected = false,
}: PageThumbnailsProps) {
  const canAddPage = pages.length < maxPages;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Story Pages ({pages.length}/{maxPages})
        </h3>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {/* Cover thumbnail as Page 0 */}
        {onCoverSelect && (
          <button
            onClick={onCoverSelect}
            className={cn(
              "relative w-14 h-14 rounded-lg border-2 overflow-hidden transition-all flex-shrink-0",
              "hover:ring-2 hover:ring-primary/50",
              isCoverSelected
                ? "border-primary ring-2 ring-primary/30"
                : "border-border"
            )}
          >
            {coverImage ? (
              <img
                src={coverImage}
                alt="Cover"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            {/* Cover badge */}
            <div className="absolute bottom-0 left-0 right-0 bg-primary/90 text-center py-0.5">
              <span className="text-[10px] font-medium text-primary-foreground">
                Cover
              </span>
            </div>
          </button>
        )}

        {pages.map((page, index) => (
          <button
            key={page.id}
            onClick={() => onPageSelect(index)}
            className={cn(
              "relative w-14 h-14 rounded-lg border-2 overflow-hidden transition-all flex-shrink-0",
              "hover:ring-2 hover:ring-primary/50",
              currentPageIndex === index && !isCoverSelected
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
        {canAddPage && (
          <button
            onClick={onAddPage}
            className={cn(
              "w-14 h-14 rounded-lg border-2 border-dashed border-border flex-shrink-0",
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
