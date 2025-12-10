import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";

interface StoryPagePreviewProps {
  image: string | null;
  text: string;
  isLoading?: boolean;
  className?: string;
}

export function StoryPagePreview({
  image,
  text,
  isLoading = false,
  className,
}: StoryPagePreviewProps) {
  const hasContent = image || text;

  return (
    <div className={cn("space-y-3", className)}>
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-primary" />
        Story Page Preview
      </h3>

      <div
        className={cn(
          "relative w-full aspect-video rounded-xl overflow-hidden border border-border shadow-lg",
          "bg-gradient-to-br from-card to-accent/20"
        )}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground font-medium animate-pulse">
                Creating your story page...
              </p>
            </div>
          </div>
        ) : hasContent ? (
          <div className="flex h-full">
            {/* Left side - Image (50% of width) */}
            <div className="w-1/2 h-full bg-muted/30 flex-shrink-0">
              {image ? (
                <img
                  src={image}
                  alt="Story illustration"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-center text-muted-foreground">
                  <div>
                    <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Image will appear here</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right side - Text (43.75% remaining) */}
            <div className="flex-1 h-full flex items-center justify-center p-4 md:p-6 lg:p-8">
              <p className="text-sm md:text-lg lg:text-xl font-serif text-foreground leading-relaxed text-center">
                {text || "Your story text will appear here..."}
              </p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Your story page preview</p>
              <p className="text-sm mt-2">
                Upload a character image and add story text to begin
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
