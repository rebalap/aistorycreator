import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, Check, X, Sparkles, ImageIcon } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface CoverPagePreviewProps {
  coverImage: string | null;
  pendingCoverImage: string | null;
  title: string;
  isGenerating: boolean;
  isEditing: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  onEdit: (prompt: string) => void;
  onAccept: () => void;
  onDiscard: () => void;
}

export const CoverPagePreview = ({
  coverImage,
  pendingCoverImage,
  title,
  isGenerating,
  isEditing,
  canGenerate,
  onGenerate,
  onEdit,
  onAccept,
  onDiscard,
}: CoverPagePreviewProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const [showEditInput, setShowEditInput] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");

  const handleEditSubmit = () => {
    if (editPrompt.trim()) {
      onEdit(editPrompt.trim());
      setEditPrompt("");
      setShowEditInput(false);
    }
  };

  // Comparison view when there's a pending edit
  if (pendingCoverImage) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground">Cover Page - Compare Changes</h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onDiscard}>
              <X className="w-4 h-4 mr-1" />
              Discard
            </Button>
            <Button size="sm" onClick={onAccept}>
              <Check className="w-4 h-4 mr-1" />
              Accept
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground text-center">Original</p>
            <AspectRatio ratio={16 / 9} className="bg-muted rounded-lg overflow-hidden">
              <img
                src={coverImage!}
                alt="Original cover"
                className="w-full h-full object-cover"
              />
            </AspectRatio>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground text-center">Edited</p>
            <AspectRatio ratio={16 / 9} className="bg-muted rounded-lg overflow-hidden">
              <img
                src={pendingCoverImage}
                alt="Edited cover"
                className="w-full h-full object-cover"
              />
            </AspectRatio>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      <div
        className="relative"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          if (!editPrompt) setShowEditInput(false);
        }}
      >
        <AspectRatio ratio={16 / 9} className="bg-muted rounded-lg overflow-hidden border border-border">
          {isGenerating || isEditing ? (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-accent/10">
              <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">
                {isEditing ? "Editing cover..." : "Generating cover..."}
              </p>
            </div>
          ) : coverImage ? (
            <>
              <img
                src={coverImage}
                alt={`Cover: ${title}`}
                className="w-full h-full object-cover"
              />
              {/* Edit overlay on hover */}
              {isHovering && !showEditInput && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowEditInput(true)}
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit Cover
                  </Button>
                </div>
              )}
              {/* Edit input overlay */}
              {showEditInput && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4">
                  <div className="w-full max-w-md space-y-2">
                    <Input
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder="e.g., Add more stars in the sky, change background to sunset..."
                      className="bg-background"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleEditSubmit();
                        if (e.key === "Escape") {
                          setShowEditInput(false);
                          setEditPrompt("");
                        }
                      }}
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setShowEditInput(false);
                          setEditPrompt("");
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleEditSubmit}
                        disabled={!editPrompt.trim()}
                      >
                        Apply Edit
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
              <ImageIcon className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No cover generated yet</p>
              <p className="text-xs mt-1">
                {canGenerate
                  ? "Click 'Generate Cover' to create one"
                  : "Add a character image and title first"}
              </p>
            </div>
          )}
        </AspectRatio>
      </div>
    </div>
  );
};
