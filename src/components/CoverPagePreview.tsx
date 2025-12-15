import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, Check, X, BookOpen, ImageIcon, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";

export type TitlePosition = 'top' | 'center' | 'bottom';
export type TitleFontStyle = 'classic' | 'modern' | 'playful' | 'bold';
export type TitleColor = 'white' | 'gold' | 'black-outline';

interface CoverPagePreviewProps {
  coverImage: string | null;
  pendingCoverImage: string | null;
  title: string;
  coverTitle: string;
  isGenerating: boolean;
  isEditing: boolean;
  canGenerate: boolean;
  onGenerate: () => void;
  onEdit: (prompt: string) => void;
  onAccept: () => void;
  onDiscard: () => void;
  onTitleChange: (title: string) => void;
  titlePosition: TitlePosition;
  titleFontStyle: TitleFontStyle;
  titleColor: TitleColor;
  onPositionChange: (position: TitlePosition) => void;
  onFontStyleChange: (style: TitleFontStyle) => void;
  onColorChange: (color: TitleColor) => void;
}

const positionClasses: Record<TitlePosition, string> = {
  top: 'items-start pt-8',
  center: 'items-center',
  bottom: 'items-end pb-8'
};

const fontClasses: Record<TitleFontStyle, string> = {
  classic: 'font-playfair',
  modern: 'font-inter',
  playful: 'font-lobster',
  bold: 'font-bebas tracking-wider text-4xl md:text-5xl'
};

const fontLabels: Record<TitleFontStyle, string> = {
  classic: 'Classic',
  modern: 'Modern',
  playful: 'Playful',
  bold: 'Bold'
};

const colorClasses: Record<TitleColor, string> = {
  white: 'text-white',
  gold: 'text-amber-400',
  'black-outline': 'text-black'
};

const colorStyles: Record<TitleColor, React.CSSProperties> = {
  white: { textShadow: "2px 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7)" },
  gold: { textShadow: "2px 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7)" },
  'black-outline': { 
    textShadow: "none",
    WebkitTextStroke: "2px white",
    paintOrder: "stroke fill"
  }
};

const colorLabels: Record<TitleColor, string> = {
  white: 'White',
  gold: 'Gold',
  'black-outline': 'Black'
};

export const CoverPagePreview = ({
  coverImage,
  pendingCoverImage,
  title,
  coverTitle,
  isGenerating,
  isEditing,
  canGenerate,
  onGenerate,
  onEdit,
  onAccept,
  onDiscard,
  onTitleChange,
  titlePosition,
  titleFontStyle,
  titleColor,
  onPositionChange,
  onFontStyleChange,
  onColorChange,
}: CoverPagePreviewProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const [showEditInput, setShowEditInput] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(coverTitle);

  const handleEditSubmit = () => {
    if (editPrompt.trim()) {
      onEdit(editPrompt.trim());
      setEditPrompt("");
      setShowEditInput(false);
    }
  };

  const handleTitleEditStart = () => {
    setEditedTitle(coverTitle);
    setIsEditingTitle(true);
  };

  const handleTitleEditSave = () => {
    onTitleChange(editedTitle);
    setIsEditingTitle(false);
  };

  const handleTitleEditCancel = () => {
    setEditedTitle(coverTitle);
    setIsEditingTitle(false);
  };

  // Title overlay component
  const TitleOverlay = ({ editable = false }: { editable?: boolean }) => (
    <div className={`absolute inset-0 flex justify-center pointer-events-none ${positionClasses[titlePosition]}`}>
      {isEditingTitle && editable ? (
        <div className="pointer-events-auto w-full max-w-md px-6 space-y-2">
          <Input
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            className="text-center text-xl font-bold bg-background/90"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTitleEditSave();
              if (e.key === "Escape") handleTitleEditCancel();
            }}
          />
          <div className="flex gap-2 justify-center">
            <Button size="sm" variant="ghost" onClick={handleTitleEditCancel} className="bg-background/80">
              Cancel
            </Button>
            <Button size="sm" onClick={handleTitleEditSave} className="bg-background/80">
              Save Title
            </Button>
          </div>
        </div>
      ) : (
        <h1
          className={`text-2xl md:text-3xl font-bold text-center px-6 leading-tight ${fontClasses[titleFontStyle]} ${colorClasses[titleColor]}`}
          style={colorStyles[titleColor]}
        >
          {coverTitle}
        </h1>
      )}
    </div>
  );

  // Comparison view when there's a pending edit
  if (pendingCoverImage) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Cover Page - Compare Changes</h3>
        </div>
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="outline" onClick={onDiscard}>
            <X className="w-4 h-4 mr-1" />
            Discard
          </Button>
          <Button size="sm" onClick={onAccept}>
            <Check className="w-4 h-4 mr-1" />
            Accept
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground text-center">Original</p>
            <div className="relative">
              <AspectRatio ratio={16 / 9} className="bg-muted rounded-lg overflow-hidden border border-border">
                <img
                  src={coverImage!}
                  alt="Original cover"
                  className="w-full h-full object-cover"
                />
                <TitleOverlay />
              </AspectRatio>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground text-center">Edited</p>
            <div className="relative">
              <AspectRatio ratio={16 / 9} className="bg-muted rounded-lg overflow-hidden border border-border">
                <img
                  src={pendingCoverImage}
                  alt="Edited cover"
                  className="w-full h-full object-cover"
                />
                <TitleOverlay />
              </AspectRatio>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium text-foreground">Cover Page Preview</h3>
      </div>

      {/* Preview Container */}
      <div className="aspect-video w-full">
        <div
          className="relative w-full h-full"
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
                {/* Title Overlay */}
                <TitleOverlay editable />
                
                {/* Hover Controls */}
                {isHovering && !showEditInput && !isEditingTitle && (
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-3 transition-opacity p-4">
                    {/* Main buttons */}
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowEditInput(true)}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit Image
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleTitleEditStart}
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Edit Title
                      </Button>
                    </div>
                    
                    {/* Position controls */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/80">Position:</span>
                      <div className="flex gap-1">
                        <Button
                          variant={titlePosition === 'top' ? 'default' : 'secondary'}
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => onPositionChange('top')}
                          title="Top"
                        >
                          <AlignVerticalJustifyStart className="w-3 h-3" />
                        </Button>
                        <Button
                          variant={titlePosition === 'center' ? 'default' : 'secondary'}
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => onPositionChange('center')}
                          title="Center"
                        >
                          <AlignVerticalJustifyCenter className="w-3 h-3" />
                        </Button>
                        <Button
                          variant={titlePosition === 'bottom' ? 'default' : 'secondary'}
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => onPositionChange('bottom')}
                          title="Bottom"
                        >
                          <AlignVerticalJustifyEnd className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Font style controls */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/80">Font:</span>
                      <div className="flex gap-1">
                        {(['classic', 'modern', 'playful', 'bold'] as TitleFontStyle[]).map((style) => (
                          <Button
                            key={style}
                            variant={titleFontStyle === style ? 'default' : 'secondary'}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => onFontStyleChange(style)}
                          >
                            {fontLabels[style]}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Color controls */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/80">Color:</span>
                      <div className="flex gap-1">
                        {(['white', 'gold', 'black-outline'] as TitleColor[]).map((color) => (
                          <Button
                            key={color}
                            variant={titleColor === color ? 'default' : 'secondary'}
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => onColorChange(color)}
                          >
                            {colorLabels[color]}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Image Edit Input */}
                {showEditInput && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center p-4">
                    <div className="w-full max-w-md space-y-2">
                      <Input
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="e.g., Add more stars, change background to sunset..."
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
    </div>
  );
};
