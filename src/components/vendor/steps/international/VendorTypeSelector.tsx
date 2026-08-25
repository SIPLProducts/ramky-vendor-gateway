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
    <div className="w-full">
      <div role="radiogroup" aria-label="Vendor Type" className="grid grid-cols-1 gap-3 w-full">
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
                'group relative w-full overflow-hidden rounded-xl',
                'bg-white border border-slate-200 shadow-sm transition-all duration-200',
                'hover:border-slate-300 hover:shadow-md',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green',
                'flex items-center justify-center gap-2 px-4 py-3.5',
                selected && 'border-brand-green ring-1 ring-brand-green',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
            >
              <h4 className="text-sm font-semibold text-slate-900 leading-tight text-center">
                {opt.title}
              </h4>
              {selected && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-6 w-6 rounded-full bg-brand-green text-white shadow-sm">
                  <Check className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          );
        })}

      </div>
    </div>
  );
}
