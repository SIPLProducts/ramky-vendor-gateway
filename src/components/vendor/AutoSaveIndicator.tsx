import { useEffect, useState } from 'react';
import { Check, Loader2, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AutoSaveState = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveIndicatorProps {
  state: AutoSaveState;
  lastSavedAt: Date | null;
  className?: string;
}

function formatRelative(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  return `${hours} hr${hours === 1 ? '' : 's'} ago`;
}

export function AutoSaveIndicator({ state, lastSavedAt, className }: AutoSaveIndicatorProps) {
  const [, force] = useState(0);

  // Re-render every 15s so the relative time stays fresh
  useEffect(() => {
    if (!lastSavedAt) return;
    const id = setInterval(() => force((v) => v + 1), 15000);
    return () => clearInterval(id);
  }, [lastSavedAt]);

  if (state === 'saving') {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)} aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Saving…</span>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-destructive', className)} aria-live="polite">
        <CloudOff className="h-3.5 w-3.5" />
        <span>Couldn't save — will retry</span>
      </div>
    );
  }

  if (state === 'saved' && lastSavedAt) {
    return (
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', className)} aria-live="polite">
        <Check className="h-3.5 w-3.5 text-success" />
        <span>Saved {formatRelative(lastSavedAt)}</span>
      </div>
    );
  }

  return null;
}
