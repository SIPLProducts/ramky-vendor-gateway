import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VendorOriginType } from '@/types/vendor';

interface Props {
  value: VendorOriginType;
  onChange: (v: VendorOriginType) => void;
  disabled?: boolean;
}

function IndianFlagIcon({ className }: { className?: string }) {
  // 24-spoke Ashoka Chakra
  const spokes = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg className={className} viewBox="0 0 36 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="36" height="8" y="0" fill="#FF9933" />
      <rect width="36" height="8" y="8" fill="#FFFFFF" />
      <rect width="36" height="8" y="16" fill="#138808" />
      <g transform="translate(18 12)" stroke="#000080" strokeWidth="0.35" fill="none">
        <circle r="3" />
        <circle r="0.6" fill="#000080" />
        {spokes.map((deg) => (
          <line key={deg} x1="0" y1="0" x2="0" y2="-3" transform={`rotate(${deg})`} />
        ))}
      </g>
      <rect width="36" height="24" fill="none" stroke="#00000010" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="gsphere" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#7DD3FC" />
          <stop offset="60%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="20" fill="url(#gsphere)" />
      {/* Continents silhouettes */}
      <g fill="#16A34A" opacity="0.9">
        <path d="M12 18c2-3 5-4 8-3 2 0 3 2 2 4-1 3-4 3-6 5-3 1-6-2-4-6z" />
        <path d="M26 14c3-1 6 1 7 3-1 2-3 2-4 4s-4 2-5 0 0-6 2-7z" />
        <path d="M22 27c3 0 6 1 7 4 1 3-2 6-5 6-4 0-6-3-5-6 0-2 1-4 3-4z" />
        <path d="M34 25c2 0 3 2 2 4-1 3-4 2-4 0s0-4 2-4z" />
      </g>
      {/* Meridians / equator */}
      <g fill="none" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="0.6">
        <ellipse cx="24" cy="24" rx="20" ry="20" />
        <ellipse cx="24" cy="24" rx="20" ry="8" />
        <ellipse cx="24" cy="24" rx="8" ry="20" />
        <line x1="4" y1="24" x2="44" y2="24" />
      </g>
    </svg>
  );
}

const OPTIONS: {
  value: VendorOriginType;
  title: string;
  desc: string;
  Icon: React.ElementType;
}[] = [
  {
    value: 'domestic',
    title: 'Domestic Vendor',
    desc: 'Indian vendors — full KYC, GST, PAN, MSME and Bank flow',
    Icon: IndianFlagIcon,
  },
  {
    value: 'international',
    title: 'International Vendor',
    desc: 'Overseas vendors — SWIFT/IBAN, country & region based flow',
    Icon: GlobeIcon,
  },
];

export function VendorTypeSelector({ value, onChange, disabled }: Props) {
  return (
    <div role="radiogroup" aria-label="Vendor Type" className="grid gap-4 md:grid-cols-2">
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
              'group relative overflow-hidden flex items-center gap-4 rounded-xl p-5 pl-6 text-left',
              'border border-blue-100 bg-blue-50/60 shadow-sm',
              'transition-all duration-200 ease-out',
              'hover:shadow-md hover:-translate-y-0.5 hover:bg-blue-50',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/50',
              selected && 'bg-blue-100/70 ring-1 ring-brand-green/40 shadow-md',
              disabled && 'opacity-60 cursor-not-allowed hover:translate-y-0 hover:shadow-sm',
            )}
          >
            {/* Left accent bar */}
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 h-full w-1.5 bg-brand-green rounded-l-xl"
            />

            {/* Icon tile */}
            <div className="h-12 w-12 shrink-0 rounded-lg bg-white shadow-sm ring-1 ring-black/5 flex items-center justify-center overflow-hidden">
              <opt.Icon className="h-8 w-8" />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0 pr-10">
              <div className="flex items-center gap-2">
                <span className="text-[18px] font-semibold text-slate-900 leading-tight">
                  {opt.title}
                </span>
                {selected && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-white bg-brand-green rounded-full px-2 py-0.5">
                    <Check className="h-3 w-3" /> Selected
                  </span>
                )}
              </div>
              <p className="mt-1 text-[14px] font-medium text-slate-600 leading-snug">
                {opt.desc}
              </p>
            </div>

            {/* Radio indicator */}
            <span
              className={cn(
                'absolute top-4 right-4 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all',
                selected
                  ? 'border-brand-green bg-brand-green'
                  : 'border-slate-300 bg-white',
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
