import { ImageUploader } from "@/components/ImageUploader";

interface MetadataBarProps {
  characterImages: string[];
  onCharacterImagesChange: (images: string[]) => void;
  backgroundImages: string[];
  onBackgroundImagesChange: (images: string[]) => void;
}

export function MetadataBar({
  characterImages,
  onCharacterImagesChange,
  backgroundImages,
  onBackgroundImagesChange,
}: MetadataBarProps) {
  return (
    <div className="bg-card rounded-xl p-4 border border-border shadow-sm">
      <div className="grid md:grid-cols-2 gap-4">
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
      </div>
    </div>
  );
}
