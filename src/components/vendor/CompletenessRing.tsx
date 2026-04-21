import { cn } from '@/lib/utils';

interface CompletenessRingProps {
  /** 0–100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
  label?: string;
}

/**
 * Small SVG progress ring used in the side rail to show overall + per-step completion.
 * Uses semantic tokens — works in both light and dark modes.
 */
export function CompletenessRing({
  value,
  size = 56,
  strokeWidth = 5,
  className,
  showLabel = true,
  label,
}: CompletenessRingProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  // Color shifts with progress for at-a-glance feedback
  const strokeClass =
    clamped >= 100
      ? 'stroke-success'
      : clamped >= 60
        ? 'stroke-primary'
        : clamped >= 25
          ? 'stroke-warning'
          : 'stroke-muted-foreground';

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('transition-[stroke-dashoffset] duration-500 ease-out', strokeClass)}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-semibold text-foreground leading-none">{clamped}%</span>
          {label && <span className="text-[10px] text-muted-foreground mt-0.5">{label}</span>}
        </div>
      )}
    </div>
  );
}
