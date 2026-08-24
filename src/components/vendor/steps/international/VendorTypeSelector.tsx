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
                'group relative w-full max-w-[200px] mx-auto overflow-hidden rounded-xl bg-white text-left',
                'shadow-md transition-shadow duration-200 hover:shadow-xl',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green',
                'flex items-center justify-center px-3 py-4',
                selected && 'ring-2 ring-brand-green shadow-[0_0_0_4px_rgba(34,197,94,0.15)]',
                disabled && 'opacity-60 cursor-not-allowed hover:shadow-md',
              )}
            >
              {selected && (
                <span className="absolute top-1 right-1 z-20 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white bg-brand-green rounded-full px-2 py-0.5 shadow">
                  <Check className="h-3 w-3" /> Selected
                </span>
              )}

              <h4 className="w-full text-center text-xs sm:text-sm font-semibold text-slate-900 leading-tight">
                {opt.title}
              </h4>
            </button>
          );
        })}
      </div>
    </div>
  );
}
