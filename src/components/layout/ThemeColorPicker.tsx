import { Palette, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useThemeColor } from '@/hooks/useThemeColor';
import { cn } from '@/lib/utils';

interface ThemeColorPickerProps {
  variant?: 'desktop' | 'mobile';
}

export function ThemeColorPicker({ variant = 'desktop' }: ThemeColorPickerProps) {
  const { current, setColor, palettes } = useThemeColor();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={variant === 'mobile' ? 'icon' : 'sm'}
          className={cn(variant === 'mobile' ? 'h-9 w-9' : 'gap-2 h-8 px-2')}
          aria-label="Change theme color"
        >
          <Palette className="h-4 w-4" />
          {variant === 'desktop' && (
            <span className="hidden md:inline text-xs">Theme</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="mb-2">
          <p className="text-sm font-semibold">Theme Color</p>
          <p className="text-xs text-muted-foreground">Pick an accent palette</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {palettes.map((p) => {
            const active = p.key === current.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setColor(p.key)}
                className={cn(
                  'group flex flex-col items-center gap-1 rounded-md border p-2 transition-all hover:border-foreground/40',
                  active ? 'border-foreground/60 ring-2 ring-ring/30' : 'border-border'
                )}
                title={p.label}
              >
                <div className="flex items-center gap-1">
                  <span
                    className="h-6 w-6 rounded-full ring-1 ring-black/10 flex items-center justify-center"
                    style={{ background: p.swatch }}
                  >
                    {active && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                  </span>
                  <span
                    className="h-4 w-4 rounded-full ring-1 ring-black/10"
                    style={{ background: p.accentSwatch }}
                  />
                </div>
                <span className="text-[10px] leading-tight text-center text-muted-foreground truncate w-full">
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
