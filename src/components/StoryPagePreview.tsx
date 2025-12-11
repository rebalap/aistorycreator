import { useState } from "react";
import { cn } from "@/lib/utils";
import { BookOpen, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface StoryPagePreviewProps {
  image: string | null;
  text: string;
  isLoading?: boolean;
  isEditingImage?: boolean;
  className?: string;
  onEditImage?: (prompt: string) => void;
  onTextChange?: (newText: string) => void;
}

export function StoryPagePreview({
  image,
  text,
  isLoading = false,
  isEditingImage = false,
  className,
  onEditImage,
  onTextChange,
}: StoryPagePreviewProps) {
  const [isHoveringImage, setIsHoveringImage] = useState(false);
  const [showImageEditInput, setShowImageEditInput] = useState(false);
  const [imageEditPrompt, setImageEditPrompt] = useState("");
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState(text);

  const hasContent = image || text;

  const handleImageEditSubmit = () => {
    if (imageEditPrompt.trim() && onEditImage) {
      onEditImage(imageEditPrompt.trim());
      setImageEditPrompt("");
      setShowImageEditInput(false);
    }
  };

  const handleTextEditStart = () => {
    setEditedText(text);
    setIsEditingText(true);
  };

  const handleTextEditSave = () => {
    if (onTextChange) {
      onTextChange(editedText);
    }
    setIsEditingText(false);
  };

  const handleTextEditCancel = () => {
    setEditedText(text);
    setIsEditingText(false);
  };

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
        {isLoading || isEditingImage ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground font-medium animate-pulse">
                {isEditingImage ? "Editing your image..." : "Creating your story page..."}
              </p>
            </div>
          </div>
        ) : hasContent ? (
          <div className="flex h-full">
            {/* Left side - Image (50% of width) */}
            <div 
              className="w-1/2 h-full flex-shrink-0 relative overflow-hidden"
              onMouseEnter={() => setIsHoveringImage(true)}
              onMouseLeave={() => setIsHoveringImage(false)}
            >
              {image ? (
                <>
                  <img
                    src={image}
                    alt="Story illustration"
                    className="w-full h-full object-cover"
                  />
                  {/* Edit overlay */}
                  {(isHoveringImage || showImageEditInput) && onEditImage && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity">
                      {showImageEditInput ? (
                        <div className="p-4 w-full max-w-xs space-y-2">
                          <Input
                            value={imageEditPrompt}
                            onChange={(e) => setImageEditPrompt(e.target.value)}
                            placeholder="Describe how to edit..."
                            className="bg-background text-foreground"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleImageEditSubmit();
                              if (e.key === "Escape") {
                                setShowImageEditInput(false);
                                setImageEditPrompt("");
                              }
                            }}
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleImageEditSubmit} className="flex-1">
                              <Check className="w-4 h-4 mr-1" />
                              Apply
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => {
                                setShowImageEditInput(false);
                                setImageEditPrompt("");
                              }}
                              className="flex-1"
                            >
                              <X className="w-4 h-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button 
                          onClick={() => setShowImageEditInput(true)}
                          variant="secondary"
                          className="gap-2"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit Image
                        </Button>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-center text-muted-foreground">
                  <div>
                    <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Image will appear here</p>
                  </div>
                </div>
              )}
            </div>

            {/* Right side - Text (50%) */}
            <div className="flex-1 h-full flex items-center justify-center p-4 md:p-6 lg:p-8 relative group">
              {isEditingText ? (
                <div className="w-full h-full flex flex-col gap-2 p-2">
                  <Textarea
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="flex-1 font-serif text-base resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" onClick={handleTextEditSave}>
                      <Check className="w-4 h-4 mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleTextEditCancel}>
                      <X className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm md:text-lg lg:text-xl font-serif text-foreground leading-relaxed text-center">
                    {text || "Your story text will appear here..."}
                  </p>
                  {/* Edit text button */}
                  {text && onTextChange && (
                    <button
                      onClick={handleTextEditStart}
                      className="absolute top-2 right-2 p-2 rounded-full bg-muted/80 hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Edit text"
                    >
                      <Pencil className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}
                </>
              )}
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
