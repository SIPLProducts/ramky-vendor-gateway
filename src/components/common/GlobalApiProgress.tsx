import { useEffect, useState } from "react";

// Tracks every in-flight fetch (database, functions, KYC/OCR providers) so a
// slim animated progress bar is shown on every screen while an API call runs.
// It always clears in `finally`, whether the request succeeded or failed.
let inflight = 0;
const listeners = new Set<(n: number) => void>();
const emit = () => listeners.forEach((l) => l(inflight));
let patched = false;

function patchFetch() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const orig = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const url = String(args[0] instanceof Request ? args[0].url : args[0]);
    // Ignore static assets and auth token refresh noise.
    const track = !/\.(js|css|png|jpe?g|svg|woff2?|json)(\?|$)/i.test(url) && !url.includes("/auth/v1/token");
    if (track) { inflight++; emit(); }
    try {
      return await orig(...args);
    } finally {
      if (track) { inflight = Math.max(0, inflight - 1); emit(); }
    }
  };
}

export function GlobalApiProgress() {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    patchFetch();
    listeners.add(setCount);
    return () => { listeners.delete(setCount); };
  }, []);
  // Small delay avoids flicker on very fast calls.
  useEffect(() => {
    if (count > 0) {
      const t = setTimeout(() => setVisible(true), 250);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [count]);
  if (!visible) return null;
  return (
    <>
      <div className="fixed top-0 inset-x-0 z-[100] h-1 overflow-hidden bg-primary/15" role="progressbar" aria-busy="true">
        <div className="h-full w-1/3 bg-gradient-to-r from-primary via-accent to-primary animate-[api-progress_1.1s_ease-in-out_infinite]" />
      </div>
      <div className="fixed bottom-4 right-4 z-[100] flex items-center gap-2 rounded-full border bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur animate-in fade-in slide-in-from-bottom-2">
        <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs font-medium text-foreground">Please wait…</span>
      </div>
    </>
  );
}
