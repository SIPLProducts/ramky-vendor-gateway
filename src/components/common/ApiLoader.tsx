import { cn } from "@/lib/utils";
import { RamkyBrandLoader } from "./RamkyBrandLoader";

interface ApiLoaderProps {
  label?: string;
  hint?: string;
  className?: string;
  size?: "sm" | "md";
}

/** Shared animated loader for API waits (tables, cards, dialogs). */
export function ApiLoader({ label = "Loading…", hint, className, size = "md" }: ApiLoaderProps) {
  return (
    <div role="status" aria-busy="true" aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-3 py-10 animate-in fade-in duration-300", className)}>
      <RamkyBrandLoader size={size === "sm" ? "sm" : "md"} />
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

/** Slim inline spinner for buttons / badges. */
export function InlineSpinner({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin motion-reduce:animate-none", className)} />
  );
}
