import { useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSapMasterData } from "@/hooks/useSapMasterData";

interface Props {
  label: string;
  masterType: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Optional filter applied against each row's `extra` JSON (e.g. { BUKRS: "1000" }). */
  filter?: Record<string, string | undefined>;
  /** Optional extra fields from `extra` to render after the description, e.g. ["BUKRS"]. */
  extraLabelFields?: string[];
  /** Deprecated: kept for backward-compatibility, no longer used. */
  allowFilterFallback?: boolean;
}

export function SapMasterCombobox({ label, masterType, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const { data: allRows, isLoading } = useSapMasterData(masterType);

  // Show all options returned by SAP for this master type — no cross-field filtering.
  const rows = allRows || [];
  const sourceRows = rows;

  const match = rows.find((r) => r.code === value);
  const displayed = match
    ? `${match.code}${match.description ? ` — ${match.description}` : ""}`
    : value || "";

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full h-9 rounded-lg justify-between font-normal"
          >
            <span className="truncate">{displayed || placeholder || "Select…"}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter>
            <CommandInput
              placeholder="Search or type custom value…"
              value={value}
              onValueChange={(v) => onChange(v)}
            />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {sourceRows.length === 0
                      ? "No SAP F4 values loaded for this field."
                      : `No match. Press Enter to keep "${value}".`}
                  </CommandEmpty>
                  <CommandGroup>
                    {rows.map((r) => (
                      <CommandItem
                        key={r.id}
                        value={`${r.code} ${r.description || ""}`}
                        onSelect={() => { onChange(r.code); setOpen(false); }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", value === r.code ? "opacity-100" : "opacity-0")} />
                        <span className="font-mono">{r.code}</span>
                        {r.description && <span className="ml-2 text-muted-foreground">— {r.description}</span>}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-[11px] text-muted-foreground">
        {isLoading
          ? "Loading F4 values…"
          : `${rows.length} option${rows.length === 1 ? "" : "s"} loaded${hasActiveFilter ? ` for current filter${filterSummary ? ` (${filterSummary})` : ""}` : ""}.`}
      </p>
    </div>
  );
}
