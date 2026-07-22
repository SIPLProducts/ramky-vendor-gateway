import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VendorOriginType } from '@/types/vendor';

interface Props {
  value: VendorOriginType;
  onChange: (v: VendorOriginType) => void;
  disabled?: boolean;
}

function IndianFlagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="5" width="20" height="14" rx="2" fill="#FF9932" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
      <path d="M2 9.667h20v4.667H2z" fill="#FFFFFF" />
      <path d="M2 14.333h20V19H2z" fill="#138808" />
      <g stroke="#000080" strokeWidth="0.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="2.2" />
        <path d="M12 9.8v4.4M9.8 12h4.4M10.44 10.44l3.12 3.12M13.56 10.44l-3.12 3.12" />
      </g>
    </svg>
  );
}

function WorldMapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 8h-2a2 2 0 0 0 -2 2a2 2 0 1 1 -4 0v-1a2 2 0 0 0 -2 -2h-1a2 2 0 0 1 -2 -2v-.5" />
      <path d="M3 12h3a2 2 0 0 1 2 2v.5a1.5 1.5 0 0 0 1.5 1.5a1.5 1.5 0 0 1 1.5 1.5v3.25" />
      <path d="M15 20.5v-3.5a2 2 0 0 1 2 -2h3.5" />
      <path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
    </svg>
  );
}

const OPTIONS: { value: VendorOriginType; title: string; Icon: React.ElementType }[] = [
  { value: 'domestic', title: 'Domestic Vendor', Icon: IndianFlagIcon },
  { value: 'international', title: 'International Vendor', Icon: WorldMapIcon },
];

export function VendorTypeSelector({ value, onChange, disabled }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Vendor Type"
      className="grid gap-3 md:grid-cols-2"
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={cn(
              'group relative flex items-start gap-3 rounded-xl border-2 bg-card p-4 text-left transition-all',
              'hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60',
              selected
                ? 'border-emerald-500 bg-emerald-50/60 shadow-[0_0_0_4px_hsl(var(--background))_inset,0_8px_24px_-12px_rgba(16,185,129,0.4)]'
                : 'border-border hover:border-emerald-300',
              disabled && 'opacity-60 cursor-not-allowed',
            )}
          >
            <div
              className={cn(
                'h-10 w-10 shrink-0 rounded-lg flex items-center justify-center',
                selected ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground',
              )}
            >
              <opt.Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-semibold', selected ? 'text-emerald-700' : 'text-foreground')}>
                  {opt.title}
                </span>
                {selected && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                    <Check className="h-3 w-3" /> Selected
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.desc}</p>
            </div>
            <span
              className={cn(
                'absolute top-3 right-3 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all',
                selected ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/40 bg-transparent',
              )}
            >
              {selected && <Check className="h-3 w-3 text-white" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
