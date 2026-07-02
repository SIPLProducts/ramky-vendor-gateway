import { useEffect, useRef } from 'react';

/**
 * Signs the user out after `minutes` of inactivity.
 * Activity: mousemove, keydown, click, scroll, touchstart.
 * Cross-tab: uses localStorage timestamp so activity in another tab resets the timer.
 */
export function useIdleLogout(opts: {
  enabled: boolean;
  minutes?: number;
  onIdle: () => void;
}) {
  const { enabled, minutes = 30, onIdle } = opts;
  const timerRef = useRef<number | null>(null);
  const KEY = 'lovable_last_activity_ts';

  useEffect(() => {
    if (!enabled) return;
    const ms = minutes * 60 * 1000;

    const reset = () => {
      try { localStorage.setItem(KEY, String(Date.now())); } catch (_) { /* ignore */ }
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => onIdle(), ms);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => onIdle(), ms);
      }
    };

    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    window.addEventListener('storage', onStorage);

    // Initialize
    reset();

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, reset));
      window.removeEventListener('storage', onStorage);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [enabled, minutes, onIdle]);
}
