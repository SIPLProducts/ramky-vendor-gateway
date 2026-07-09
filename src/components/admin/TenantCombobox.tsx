import { useMemo, useState } from 'react';
import { Check, ChevronDown, Building2 } from 'lucide-react';
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
  value?: string | null;                       // single-select value; null = "All Tenants" when allowAll
  onChange?: (id: string | null) => void;
  /** Multi-select mode. When set, `values`/`onChangeMulti` are used. */
  multi?: boolean;
  values?: string[] | null;                     // multi-select selection; null/empty = "All Tenants"
  onChangeMulti?: (ids: string[] | null) => void;
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
  multi,
  values,
  onChangeMulti,
  userCounts,
  allowAll = false,
  allLabel = 'All Tenants',
  placeholder = 'Select tenant',
  className,
  triggerClassName,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedIds = useMemo<string[]>(() => {
    if (multi) return Array.isArray(values) ? values : [];
    return value ? [value] : [];
  }, [multi, values, value]);

  const isAll = multi
    ? selectedIds.length === 0
    : (allowAll && (value === null || value === undefined || value === ALL_VALUE));

  const triggerLabel = useMemo(() => {
    if (isAll) return allLabel;
    if (multi) {
      if (selectedIds.length === 1) {
        const t = tenants.find((x) => x.id === selectedIds[0]);
        return t ? t.name : placeholder;
      }
      return `${selectedIds.length} tenants selected`;
    }
    const t = tenants.find((x) => x.id === value);
    if (!t) return placeholder;
    const c = userCounts?.[t.id];
    return c != null ? `${t.name} · ${c} user${c === 1 ? '' : 's'}` : t.name;
  }, [isAll, multi, selectedIds, tenants, value, userCounts, allLabel, placeholder]);

  const isPlaceholder = !isAll && selectedIds.length === 0;

  const toggleMulti = (id: string) => {
    if (!multi || !onChangeMulti) return;
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const next = Array.from(set);
    onChangeMulti(next.length > 0 ? next : null);
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={disabled}
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              triggerClassName,
            )}
          >
            <span className={cn('flex items-center gap-2 truncate', isPlaceholder && 'text-muted-foreground')}>
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{triggerLabel}</span>
            </span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[260px]" align="start">
          <Command>
            <CommandInput placeholder="Search tenant…" />
            {multi && tenants.length > 0 && (
              <div className="flex items-center justify-between border-b px-2 py-1.5 text-xs">
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => onChangeMulti?.(tenants.map((t) => t.id))}
                >
                  Select all
                </button>
                <span className="text-muted-foreground">
                  {selectedIds.length}/{tenants.length} selected
                </span>
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => onChangeMulti?.(null)}
                >
                  Clear all
                </button>
              </div>
            )}
            <CommandList>
              <CommandEmpty>No tenant found.</CommandEmpty>
              <CommandGroup>
                {allowAll && (
                  <CommandItem
                    value={allLabel}
                    onSelect={() => {
                      if (multi) {
                        onChangeMulti?.(null);
                      } else {
                        onChange?.(null);
                      }
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', isAll ? 'opacity-100' : 'opacity-0')} />
                    {allLabel}
                  </CommandItem>
                )}

                {tenants.map((t) => {
                  const c = userCounts?.[t.id];
                  const isSelected = selectedIds.includes(t.id);
                  return (
                    <CommandItem
                      key={t.id}
                      value={`${t.name} ${t.code ?? ''}`}
                      onSelect={() => {
                        if (multi) {
                          toggleMulti(t.id);
                        } else {
                          onChange?.(t.id);
                          setOpen(false);
                        }
                      }}
                    >
                      <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
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
