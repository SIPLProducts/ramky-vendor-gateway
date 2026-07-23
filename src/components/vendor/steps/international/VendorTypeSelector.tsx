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
    <div className="rounded-xl p-0 flex-1 min-h-0 flex">
      <div role="radiogroup" aria-label="Vendor Type" className="grid grid-cols-1 gap-2 sm:gap-3 md:gap-4 w-full flex-1 min-h-0">
        {OPTIONS.map((opt, idx) => {
          const selected = value === opt.value;
          return (
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              style={{ animationDelay: `${idx * 120}ms` }}
              className={cn(
                'group relative w-full overflow-hidden rounded-xl bg-white text-left animate-fade-in',
                'shadow-md transition-all duration-300 ease-out',
                'hover:-translate-y-0.5 hover:shadow-xl',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green',
                'flex-1 min-h-0 flex flex-col',
                selected && 'ring-2 ring-brand-green shadow-[0_0_0_4px_rgba(34,197,94,0.15)]',
                disabled && 'opacity-60 cursor-not-allowed hover:translate-y-0 hover:shadow-md',
              )}
            >
              {selected && (
                <span className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white bg-brand-green rounded-full px-2.5 py-1 shadow animate-fade-in">
                  <Check className="h-3 w-3" /> Selected
                </span>
              )}

              <div className="relative w-full aspect-[16/9] overflow-hidden">
                <img
                  src={opt.image}
                  alt={opt.alt}
                  className={cn(
                    'absolute inset-0 w-full h-full object-cover select-none pointer-events-none',
                    'animate-ken-burns',
                    'transition-transform duration-700 ease-out group-hover:scale-[1.08]',
                  )}
                  draggable={false}
                />
              </div>


              <h4 className="w-full text-center py-2 sm:py-3 text-sm sm:text-base md:text-[17px] font-semibold text-slate-900 leading-tight bg-white">
                {opt.title}
              </h4>
            </button>


          );
        })}
      </div>
    </div>
  );
}

