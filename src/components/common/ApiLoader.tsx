import { cn } from "@/lib/utils";

interface ApiLoaderProps {
  label?: string;
  hint?: string;
  className?: string;
  size?: "sm" | "md";
}

/** Shared animated loader for API waits (tables, cards, dialogs). */
export function ApiLoader({ label = "Loading…", hint, className, size = "md" }: ApiLoaderProps) {
  const dim = size === "sm" ? "h-8 w-8" : "h-12 w-12";
  return (
    <div role="status" aria-busy="true" aria-live="polite"
      className={cn("flex flex-col items-center justify-center gap-3 py-10 animate-in fade-in duration-300", className)}>
      <div className={cn("relative", dim)}>
        <span className="absolute inset-0 rounded-full bg-primary/15 animate-ping motion-reduce:hidden" />
        <span className="absolute inset-0 rounded-full border-4 border-primary/15" />
        <span className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary animate-spin motion-reduce:animate-none" />
      </div>
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
