import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText } from "lucide-react";

interface RestoreDraftDialogProps {
  open: boolean;
  title: string;
  lastSaved: Date;
  onRestore: () => void;
  onDiscard: () => void;
}

export const RestoreDraftDialog = ({
  open,
  title,
  lastSaved,
  onRestore,
  onDiscard,
}: RestoreDraftDialogProps) => {
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Restore Previous Work?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>
              We found an unsaved draft from your previous session:
            </p>
            <div className="bg-muted rounded-lg p-3 mt-2">
              <p className="font-medium text-foreground">{title || "Untitled Story"}</p>
              <p className="text-xs text-muted-foreground">
                Last saved {formatDate(lastSaved)}
              </p>
            </div>
            <p className="pt-2">
              Would you like to restore this draft or start fresh?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>Start Fresh</AlertDialogCancel>
          <AlertDialogAction onClick={onRestore}>Restore Draft</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
