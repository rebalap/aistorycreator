import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Pencil, Check, X, BookOpen, ImageIcon, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, CheckCircle2, Circle, Sparkles, Palette } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type TitlePosition = 'top' | 'center' | 'bottom';
export type TitleFontStyle = 'classic' | 'modern' | 'playful' | 'bold' | 'comic';
export type TitleFontSize = 'small' | 'medium' | 'large';

interface CoverPagePreviewProps {
  coverImage: string | null;
  pendingCoverImage: string | null;
  title: string;
  coverTitle: string;
  isGenerating: boolean;
  isEditing: boolean;
  canGenerate: boolean;
  hasCharacterImage: boolean;
  onGenerate: () => void;
  onEdit: (prompt: string) => void;
  onAccept: () => void;
  onDiscard: () => void;
  onTitleChange: (title: string) => void;
  titlePosition: TitlePosition;
  titleFontStyle: TitleFontStyle;
  titleColor: string;
  titleFontSize: TitleFontSize;
  onPositionChange: (position: TitlePosition) => void;
  onFontStyleChange: (style: TitleFontStyle) => void;
  onColorChange: (color: string) => void;
  onFontSizeChange: (size: TitleFontSize) => void;
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
  bold: 'font-bebas tracking-wider',
  comic: 'font-comic'
};

const fontLabels: Record<TitleFontStyle, string> = {
  classic: 'Classic',
  modern: 'Modern',
  playful: 'Playful',
  bold: 'Bold',
  comic: 'Comic'
};

const fontSizeClasses: Record<TitleFontSize, string> = {
  small: 'text-xl md:text-2xl',
  medium: 'text-2xl md:text-3xl',
  large: 'text-3xl md:text-5xl'
};

const fontSizeLabels: Record<TitleFontSize, string> = {
  small: 'S',
  medium: 'M',
  large: 'L'
};

// Preset colors for quick selection
const presetColors = [
  { value: '#FFFFFF', label: 'White' },
  { value: '#F59E0B', label: 'Gold' },
  { value: '#000000', label: 'Black' },
  { value: '#EF4444', label: 'Red' },
  { value: '#3B82F6', label: 'Blue' },
  { value: '#10B981', label: 'Green' },
  { value: '#8B5CF6', label: 'Purple' },
  { value: '#EC4899', label: 'Pink' },
];

// Helper to determine if color is light or dark for text shadow
const isLightColor = (hex: string): boolean => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
};

const getColorStyles = (color: string): React.CSSProperties => {
  if (isLightColor(color)) {
    return { 
      color,
      textShadow: "2px 2px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7)" 
    };
  } else {
    return { 
      color,
      textShadow: "none",
      WebkitTextStroke: "2px white",
      paintOrder: "stroke fill"
    };
  }
};

export const CoverPagePreview = ({
  coverImage,
  pendingCoverImage,
  title,
  coverTitle,
  isGenerating,
  isEditing,
  canGenerate,
  hasCharacterImage,
  onGenerate,
  onEdit,
  onAccept,
  onDiscard,
  onTitleChange,
  titlePosition,
  titleFontStyle,
  titleColor,
  titleFontSize,
  onPositionChange,
  onFontStyleChange,
  onColorChange,
  onFontSizeChange,
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
          className={`font-bold text-center px-6 leading-tight ${fontClasses[titleFontStyle]} ${fontSizeClasses[titleFontSize]}`}
          style={getColorStyles(titleColor)}
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
                      {(['classic', 'modern', 'playful', 'bold', 'comic'] as TitleFontStyle[]).map((style) => (
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
                    
                    {/* Size controls */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/80">Size:</span>
                      <div className="flex gap-1">
                        {(['small', 'medium', 'large'] as TitleFontSize[]).map((size) => (
                          <Button
                            key={size}
                            variant={titleFontSize === size ? 'default' : 'secondary'}
                            size="sm"
                            className="h-7 w-7 p-0 text-xs"
                            onClick={() => onFontSizeChange(size)}
                          >
                            {fontSizeLabels[size]}
                          </Button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Color controls */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/80">Color:</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2 gap-1"
                          >
                            <div 
                              className="w-4 h-4 rounded border border-white/30" 
                              style={{ backgroundColor: titleColor }}
                            />
                            <Palette className="w-3 h-3" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-3" align="center">
                          <div className="space-y-3">
                            <div className="grid grid-cols-4 gap-2">
                              {presetColors.map((preset) => (
                                <button
                                  key={preset.value}
                                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                                    titleColor === preset.value ? 'border-primary scale-110' : 'border-transparent hover:scale-105'
                                  }`}
                                  style={{ backgroundColor: preset.value }}
                                  onClick={() => onColorChange(preset.value)}
                                  title={preset.label}
                                />
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-muted-foreground">Custom:</label>
                              <input
                                type="color"
                                value={titleColor}
                                onChange={(e) => onColorChange(e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                              />
                              <Input
                                value={titleColor}
                                onChange={(e) => onColorChange(e.target.value)}
                                placeholder="#FFFFFF"
                                className="h-7 w-24 text-xs"
                              />
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
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
              <div className="w-full h-full flex flex-col p-4 bg-gradient-to-br from-muted/50 to-muted">
                {/* Requirements Checklist */}
                <div className="space-y-2 mb-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Requirements</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-sm">
                      {title && title !== "Untitled Story" ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={title && title !== "Untitled Story" ? "text-foreground" : "text-muted-foreground"}>
                        Story Title: {title && title !== "Untitled Story" ? `"${title}"` : "(enter in header)"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {hasCharacterImage ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground" />
                      )}
                      <span className={hasCharacterImage ? "text-foreground" : "text-muted-foreground"}>
                        Character Image: {hasCharacterImage ? "Uploaded" : "(upload above)"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Style Options */}
                <div className="space-y-3 flex-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Title Style</p>
                  
                  {/* Position */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-14">Position:</span>
                    <div className="flex gap-1">
                      <Button
                        variant={titlePosition === 'top' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => onPositionChange('top')}
                        title="Top"
                      >
                        <AlignVerticalJustifyStart className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={titlePosition === 'center' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => onPositionChange('center')}
                        title="Center"
                      >
                        <AlignVerticalJustifyCenter className="w-3 h-3" />
                      </Button>
                      <Button
                        variant={titlePosition === 'bottom' ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => onPositionChange('bottom')}
                        title="Bottom"
                      >
                        <AlignVerticalJustifyEnd className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Font Style */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-14">Font:</span>
                    <div className="flex gap-1 flex-wrap">
                      {(['classic', 'modern', 'playful', 'bold', 'comic'] as TitleFontStyle[]).map((style) => (
                        <Button
                          key={style}
                          variant={titleFontStyle === style ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => onFontStyleChange(style)}
                        >
                          {fontLabels[style]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Font Size */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-14">Size:</span>
                    <div className="flex gap-1">
                      {(['small', 'medium', 'large'] as TitleFontSize[]).map((size) => (
                        <Button
                          key={size}
                          variant={titleFontSize === size ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 w-7 p-0 text-xs"
                          onClick={() => onFontSizeChange(size)}
                        >
                          {fontSizeLabels[size]}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Color */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-14">Color:</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 gap-1"
                        >
                          <div 
                            className="w-4 h-4 rounded border border-border" 
                            style={{ backgroundColor: titleColor }}
                          />
                          <Palette className="w-3 h-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3" align="start">
                        <div className="space-y-3">
                          <div className="grid grid-cols-4 gap-2">
                            {presetColors.map((preset) => (
                              <button
                                key={preset.value}
                                className={`w-8 h-8 rounded-full border-2 transition-all ${
                                  titleColor === preset.value ? 'border-primary scale-110' : 'border-transparent hover:scale-105'
                                }`}
                                style={{ backgroundColor: preset.value }}
                                onClick={() => onColorChange(preset.value)}
                                title={preset.label}
                              />
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">Custom:</label>
                            <input
                              type="color"
                              value={titleColor}
                              onChange={(e) => onColorChange(e.target.value)}
                              className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                            />
                            <Input
                              value={titleColor}
                              onChange={(e) => onColorChange(e.target.value)}
                              placeholder="#FFFFFF"
                              className="h-7 w-24 text-xs"
                            />
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Generate Button */}
                <Button
                  onClick={onGenerate}
                  disabled={!canGenerate || isGenerating}
                  className="w-full mt-3"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Cover
                </Button>
              </div>
            )}
          </AspectRatio>
        </div>
      </div>
    </div>
  );
};
