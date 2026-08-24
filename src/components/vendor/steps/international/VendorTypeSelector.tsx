import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VendorOriginType } from '@/types/vendor';

interface Props {
  value: VendorOriginType;
  onChange: (v: VendorOriginType) => void;
  disabled?: boolean;
}

const OPTIONS: {
  value: VendorOriginType;
  title: string;
}[] = [
  { value: 'domestic', title: 'Domestic Vendor' },
  { value: 'international', title: 'International Vendor' },
];

export function VendorTypeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="rounded-xl p-0 w-full min-h-0 shrink">
      <div role="radiogroup" aria-label="Vendor Type" className="grid grid-cols-1 gap-2 w-full">
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
                'group relative w-full max-w-[220px] mx-auto overflow-hidden rounded-xl text-left',
                'bg-white/45 backdrop-blur-sm border border-white/60',
                'shadow-sm transition-all duration-200 hover:bg-white/70 hover:shadow-md',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green',
                'flex items-center justify-between gap-2 px-3 py-3',
                selected && 'border-brand-green ring-1 ring-brand-green bg-white/70',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
            >
              <h4 className="flex-1 text-center text-xs sm:text-sm font-semibold text-slate-900 leading-tight">
                {opt.title}
              </h4>
              {selected && (
                <span className="shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-full bg-brand-green text-white shadow-sm">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
