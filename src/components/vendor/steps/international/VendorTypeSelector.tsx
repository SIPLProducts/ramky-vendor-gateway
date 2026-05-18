import { Check, Globe2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VendorOriginType } from '@/types/vendor';

interface Props {
  value: VendorOriginType;
  onChange: (v: VendorOriginType) => void;
  disabled?: boolean;
}

const OPTIONS: { value: VendorOriginType; title: string; desc: string; Icon: React.ElementType }[] = [
  { value: 'domestic', title: 'Domestic Vendor', desc: 'Indian vendors — full KYC, GST, PAN, MSME and Bank flow', Icon: MapPin },
  { value: 'international', title: 'International Vendor', desc: 'Overseas vendors — SWIFT/IBAN, country & region based flow', Icon: Globe2 },
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
