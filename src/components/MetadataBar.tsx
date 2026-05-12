import { ImageUploader } from "@/components/ImageUploader";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Languages } from "lucide-react";

interface MetadataBarProps {
  characterImages: string[];
  onCharacterImagesChange: (images: string[]) => void;
  backgroundImages: string[];
  onBackgroundImagesChange: (images: string[]) => void;
  language: "en" | "ar" | "te";
  onLanguageChange: (language: "en" | "ar" | "te") => void;
}

export function MetadataBar({
  characterImages,
  onCharacterImagesChange,
  backgroundImages,
  onBackgroundImagesChange,
  language,
  onLanguageChange,
}: MetadataBarProps) {
  return (
    <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
      <div className="grid md:grid-cols-3 gap-4">
        <ImageUploader
          label="Main Character"
          description="Upload character illustration for consistency across pages"
          images={characterImages}
          onImagesChange={onCharacterImagesChange}
          compact
        />
        <ImageUploader
          label="Background References"
          description="Optional reference images for style and palette"
          multiple
          images={backgroundImages}
          onImagesChange={onBackgroundImagesChange}
          compact
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Language</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Choose story language direction
          </p>
          <ToggleGroup
            type="single"
            value={language}
            onValueChange={(value) => {
              if (value) onLanguageChange(value as "en" | "ar" | "te");
            }}
            className="justify-start"
          >
            <ToggleGroupItem value="en" aria-label="English" className="px-4">
              English
            </ToggleGroupItem>
            <ToggleGroupItem value="ar" aria-label="Arabic" className="px-4">
              عربي
            </ToggleGroupItem>
            <ToggleGroupItem value="te" aria-label="Telugu" className="px-4">
              తెలుగు
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
    </div>
  );
}
