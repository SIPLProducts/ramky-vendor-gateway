import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VendorOriginType } from '@/types/vendor';
import domesticIllustration from '@/assets/vendor-domestic-flag.png';
import internationalIllustration from '@/assets/vendor-international-map.png';

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
    alt: 'Indian flag',
  },
  {
    value: 'international',
    title: 'International Vendor',
    image: internationalIllustration,
    alt: 'World map',
  },
];

export function VendorTypeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="rounded-xl p-0 w-full shrink-0">
      <div role="radiogroup" aria-label="Vendor Type" className="grid grid-cols-1 gap-2 sm:gap-3 md:gap-4 w-full">
        {OPTIONS.map((opt, idx) => {
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
                'group relative w-full max-w-[300px] mx-auto overflow-hidden rounded-xl bg-white text-left',
                'shadow-md transition-shadow duration-200',
                'hover:shadow-xl',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green',
                'flex flex-col',
                selected && 'ring-2 ring-brand-green shadow-[0_0_0_4px_rgba(34,197,94,0.15)]',
                disabled && 'opacity-60 cursor-not-allowed hover:shadow-md',
              )}
            >
              {selected && (
                <span className="absolute top-2 right-2 z-20 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white bg-brand-green rounded-full px-2 py-0.5 shadow">
                  <Check className="h-3 w-3" /> Selected
                </span>
              )}

              <div
                className="relative w-full overflow-hidden bg-white"
                style={{ height: 'clamp(80px, 14vh, 150px)' }}
              >
                <img
                  src={opt.image}
                  alt={opt.alt}
                  className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                  draggable={false}
                />
              </div>

              <h4 className="w-full shrink-0 text-center py-1 text-xs sm:text-sm font-semibold text-slate-900 leading-tight bg-white">
                {opt.title}
              </h4>

            </button>




          );
        })}
      </div>
    </div>
  );
}

