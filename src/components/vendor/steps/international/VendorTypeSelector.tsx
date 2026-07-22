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
  desc: string;
}[] = [
  {
    value: 'domestic',
    title: 'Domestic Vendor',
    desc: 'Indian vendors — full KYC, GST, PAN, MSME and Bank flow',
  },
  {
    value: 'international',
    title: 'International Vendor',
    desc: 'Overseas vendors — SWIFT/IBAN, country & region based flow',
  },
];

export function VendorTypeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="rounded-2xl p-6 bg-blue-50/60 border border-blue-100/80 shadow-sm">
      <div role="radiogroup" aria-label="Vendor Type" className="flex flex-col gap-4">
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
                'group relative w-full rounded-xl bg-white p-5 text-left',
                'shadow-lg transition-all duration-200 ease-out',
                'hover:-translate-y-0.5 hover:shadow-2xl',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green',
                selected && 'ring-2 ring-brand-green',
                disabled && 'opacity-60 cursor-not-allowed hover:translate-y-0 hover:shadow-lg',
              )}
            >
              {selected && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white bg-brand-green rounded-full px-2.5 py-1 shadow">
                  <Check className="h-3 w-3" /> Selected
                </span>
              )}

              <h4 className="text-center text-[18px] font-semibold text-slate-900 leading-tight">
                {opt.title}
              </h4>

              <p className="text-center text-[13px] font-medium text-slate-600 leading-snug mt-2">
                {opt.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
