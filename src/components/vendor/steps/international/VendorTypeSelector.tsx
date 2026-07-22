import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VendorOriginType } from '@/types/vendor';
import domesticIllustration from '@/assets/vendor-domestic-3d.png';
import internationalIllustration from '@/assets/vendor-international-3d.png';

interface Props {
  value: VendorOriginType;
  onChange: (v: VendorOriginType) => void;
  disabled?: boolean;
}

const OPTIONS: {
  value: VendorOriginType;
  title: string;
  image: string;
  alt: string;
}[] = [
  {
    value: 'domestic',
    title: 'Domestic Vendor',
    image: domesticIllustration,
    alt: 'Domestic vendor illustration',
  },
  {
    value: 'international',
    title: 'International Vendor',
    image: internationalIllustration,
    alt: 'International vendor illustration',
  },
];

export function VendorTypeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="rounded-xl p-0">
      <div role="radiogroup" aria-label="Vendor Type" className="flex flex-col gap-3">{/* transparent — parent card owns the background */}
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
                'group relative w-full rounded-xl bg-white/40 backdrop-blur-sm border border-white/50 p-5 text-left',
                'shadow-md transition-all duration-200 ease-out',
                'hover:-translate-y-0.5 hover:shadow-xl hover:bg-white/60',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green',
                selected && 'ring-2 ring-brand-green bg-white/75',
                disabled && 'opacity-60 cursor-not-allowed hover:translate-y-0 hover:shadow-md',
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

              <div className="mt-3 flex justify-center">
                <img
                  src={opt.image}
                  alt={opt.alt}
                  className="h-32 w-auto object-contain select-none pointer-events-none"
                  draggable={false}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
