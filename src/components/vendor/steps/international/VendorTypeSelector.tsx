import { Building2, Check, Circle, Globe2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VendorOriginType } from '@/types/vendor';
import { Button } from '@/components/ui/button';

interface Props {
  value: VendorOriginType;
  onChange: (v: VendorOriginType) => void;
  disabled?: boolean;
}

const OPTIONS: {
  value: VendorOriginType;
  title: string;
  icon: typeof Building2;
}[] = [
  { value: 'domestic', title: 'Domestic Vendor', icon: Building2 },
  { value: 'international', title: 'International Vendor', icon: Globe2 },
];

export function VendorTypeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="w-full">
      <div role="radiogroup" aria-label="Vendor Type" className="grid grid-cols-1 gap-3 w-full">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value;
          return (
            <Button
              key={opt.value}
              type="button"
              variant="outline"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                'group relative h-14 w-full overflow-hidden rounded-lg px-4',
                'bg-registration-option border-registration-option-border text-registration-option-foreground shadow-sm transition-all duration-200',
                'hover:bg-registration-option hover:border-registration-accent hover:shadow-md',
                'focus-visible:ring-registration-accent focus-visible:ring-offset-registration-panel',
                'grid grid-cols-[24px_1fr_24px] items-center gap-3',
                selected && 'border-registration-accent ring-1 ring-registration-accent shadow-registration-glow',
                disabled && 'opacity-60 cursor-not-allowed',
              )}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-registration-icon text-registration-panel">
                <opt.icon className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-semibold leading-tight text-center">
                {opt.title}
              </span>
              {selected ? (
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-registration-accent text-registration-accent-foreground shadow-sm">
                  <Check className="h-3.5 w-3.5" />
                </span>
              ) : (
                <Circle className="h-6 w-6 text-registration-radio" strokeWidth={1.25} />
              )}
            </Button>
          );
        })}

      </div>
    </div>
  );
}
