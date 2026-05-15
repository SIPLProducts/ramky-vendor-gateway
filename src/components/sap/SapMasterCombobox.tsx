import { useMemo, useState } from "react";
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
  filter?: Record<string, string | undefined>;
  extraLabelFields?: string[];
  allowFilterFallback?: boolean;
  /** Live items from SAP F4 response. When provided, overrides the cached DB rows. */
  liveItems?: any[] | null;
}

// Map our internal master_type -> SAP key fields used to render labels exactly like SAP F4 response
const SAP_FIELDS: Record<string, { code: string; desc?: string; prefix?: string }> = {
  vendor_account_group: { code: "KTOKK", desc: "TXT30" },
  company_code:         { code: "BUKRS", desc: "BUTXT" },
  planning_group:       { code: "GRUPP" },
  recon_account:        { code: "SAKNR", desc: "TXT20", prefix: "BUKRS" },
  purchase_org:         { code: "EKORG", desc: "EKOTX" },
  currency:             { code: "WAERS", desc: "LTEXT" },
};

function buildLabel(masterType: string, row: { code: string; description: string | null; extra: any }) {
  const map = SAP_FIELDS[masterType];
  const extra = row.extra || {};
  if (!map) {
    return row.description ? `${row.code} — ${row.description}` : row.code;
  }
  const code = extra[map.code] ?? row.code;
  const desc = map.desc ? (extra[map.desc] ?? row.description) : null;
  const prefix = map.prefix ? extra[map.prefix] : null;
  const codePart = prefix ? `${prefix} / ${code}` : String(code);
  return desc ? `${codePart} — ${desc}` : codePart;
}

export function SapMasterCombobox({ label, masterType, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: allRows, isLoading } = useSapMasterData(masterType);

  const rows = allRows || [];

  const labelFor = useMemo(() => {
    const m = rows.find((r) => r.code === value);
    if (m) return buildLabel(masterType, m as any);
    return value || "";
  }, [rows, value, masterType]);

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(""); }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full h-9 rounded-lg justify-between font-normal"
          >
            <span className="truncate">{labelFor || placeholder || "Select…"}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter>
            <CommandInput
              placeholder="Search…"
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {rows.length === 0
                      ? "No SAP F4 values loaded for this field."
                      : "No match."}
                  </CommandEmpty>
                  <CommandGroup>
                    {rows.map((r) => {
                      const text = buildLabel(masterType, r as any);
                      return (
                        <CommandItem
                          key={r.id}
                          value={text}
                          onSelect={() => { onChange(r.code); setOpen(false); setSearch(""); }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", value === r.code ? "opacity-100" : "opacity-0")} />
                          <span className="font-mono text-xs">{text}</span>
                        </CommandItem>
                      );
                    })}
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
          : `${rows.length} option${rows.length === 1 ? "" : "s"} loaded.`}
      </p>
    </div>
  );
}
