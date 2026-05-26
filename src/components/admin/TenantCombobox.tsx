import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface TenantOption {
  id: string;
  name: string;
  code?: string | null;
}

interface Props {
  tenants: TenantOption[];
  value: string | null;                       // null = "All Tenants" when allowAll
  onChange: (id: string | null) => void;
  userCounts?: Record<string, number>;
  allowAll?: boolean;
  allLabel?: string;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

const ALL_VALUE = '__all__';

export function TenantCombobox({
  tenants,
  value,
  onChange,
  userCounts,
  allowAll = false,
  allLabel = 'All Tenants',
  placeholder = 'Select tenant',
  className,
  triggerClassName,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (allowAll && (value === null || value === ALL_VALUE)) return allLabel;
    const t = tenants.find((x) => x.id === value);
    if (!t) return placeholder;
    const c = userCounts?.[t.id];
    return c != null ? `${t.name} · ${c} user${c === 1 ? '' : 's'}` : t.name;
  }, [tenants, value, userCounts, allowAll, allLabel, placeholder]);

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn('w-full justify-between font-normal', triggerClassName)}
          >
            <span className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{selectedLabel}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[260px]" align="start">
          <Command>
            <CommandInput placeholder="Search tenant…" />
            <CommandList>
              <CommandEmpty>No tenant found.</CommandEmpty>
              <CommandGroup>
                {allowAll && (
                  <CommandItem
                    value={allLabel}
                    onSelect={() => { onChange(null); setOpen(false); }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', value === null ? 'opacity-100' : 'opacity-0')} />
                    {allLabel}
                  </CommandItem>
                )}
                {tenants.map((t) => {
                  const c = userCounts?.[t.id];
                  return (
                    <CommandItem
                      key={t.id}
                      value={`${t.name} ${t.code ?? ''}`}
                      onSelect={() => { onChange(t.id); setOpen(false); }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', value === t.id ? 'opacity-100' : 'opacity-0')} />
                      <span className="flex-1 truncate">{t.name}</span>
                      {c != null && (
                        <span className="ml-2 text-xs text-muted-foreground shrink-0">
                          {c} user{c === 1 ? '' : 's'}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
