import { toast } from "sonner";
import { CreditCard } from "lucide-react";

export const showCreditsExhaustedToast = () => {
  toast.error(
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 font-medium">
        <CreditCard className="w-4 h-4" />
        <span>AI Credits Exhausted</span>
      </div>
      <p className="text-sm text-muted-foreground">
        You've run out of AI credits. Add more to your workspace to continue creating beautiful stories.
      </p>
      <a 
        href="https://lovable.dev/settings" 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-sm font-medium text-primary hover:underline"
      >
        Add Credits →
      </a>
    </div>,
    {
      duration: 10000,
    }
  );
};

export const isCreditsExhaustedError = (error: any): boolean => {
  // Check for 402 status or CREDITS_EXHAUSTED code
  if (error?.message?.includes("402") || error?.message?.includes("CREDITS_EXHAUSTED")) {
    return true;
  }
  // Check if error object has code property
  if (error?.code === "CREDITS_EXHAUSTED") {
    return true;
  }
  // Check if error message contains our specific credit error
  if (error?.message?.includes("run out of AI credits") || 
      error?.message?.includes("Usage limit reached") ||
      error?.message?.includes("Payment required")) {
    return true;
  }
  return false;
};
