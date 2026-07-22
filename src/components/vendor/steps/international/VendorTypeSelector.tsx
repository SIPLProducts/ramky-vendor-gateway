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
  desc: string;
  image: string;
  alt: string;
}[] = [
  {
    value: 'domestic',
    title: 'Domestic Vendor',
    desc: 'Indian vendors — full KYC, GST, PAN, MSME and Bank flow',
    image: domesticIllustration,
    alt: 'Indian KYC documents illustration',
  },
  {
    value: 'international',
    title: 'International Vendor',
    desc: 'Overseas vendors — SWIFT/IBAN, country & region based flow',
    image: internationalIllustration,
    alt: 'International globe and travel illustration',
  },
];

export function VendorTypeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="rounded-2xl p-6 bg-gradient-to-b from-[#0b1a3a] via-[#0f2350] to-[#0b1a3a] shadow-xl">
      <div className="mb-5">
        <h3 className="text-white text-lg font-semibold">Select Vendor Type</h3>
        <p className="text-white/60 text-xs mt-1">
          Choose the vendor category to begin your registration. You can change this later.
        </p>
      </div>

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

              <div className="flex items-center justify-center h-40 my-3">
                <img
                  src={opt.image}
                  alt={opt.alt}
                  loading="lazy"
                  className="max-h-40 w-auto object-contain drop-shadow-md"
                />
              </div>

              <p className="text-center text-[13px] font-medium text-slate-600 leading-snug">
                {opt.desc}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
