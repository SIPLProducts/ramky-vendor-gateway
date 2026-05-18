import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Server, Loader2, Building2, Briefcase, ShoppingCart, FileCheck2 } from 'lucide-react';
import type { VendorRow } from '@/hooks/useVendors';
import { supabase } from '@/integrations/supabase/client';
import type { SapFieldOverrides } from './SapFieldsDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: VendorRow[];
  onConfirm: (overrides: SapFieldOverrides) => void;
  isSubmitting: boolean;
}

const REQUIRED_KEYS: Array<keyof SapFieldOverrides> = ['partn_grp', 'bukrs', 'akont', 'fdgrv', 'vkorg', 'waers'];
const REQUIRED_LABELS: Record<string, string> = {
  partn_grp: 'Vendor Account Group',
  bukrs: 'Company Code',
  akont: 'Rec-Account',
  fdgrv: 'Planning Group',
  vkorg: 'Purchase Org',
  waers: 'Currency',
};

function buildCommonDefaults(tenantDefaults: any | null): SapFieldOverrides {
  const d = tenantDefaults || {};
  return {
    partn_cat: d.partn_cat ?? '2',
    partn_grp: d.partn_grp ?? '',
    title: d.title ?? '0003',
    taxtype: d.taxtype ?? 'IN3',
    msme: '', // per-vendor — ignored here
    idtype: '', idnum: '',
    bukrs: d.bukrs ?? '',
    akont: d.akont ?? '',
    zuawa: d.zuawa ?? '014',
    cdi: d.cdi ?? 'X',
    fdgrv: d.fdgrv ?? '',
    vkorg: d.vkorg ?? '',
    waers: d.waers ?? '',
    kalsk: d.kalsk ?? 'L1',
    webre: d.webre ?? 'X',
    lebre: d.lebre ?? 'X',
    ven_class: d.ven_class ?? '',
    classify: { MGV: [], CATV: [], LOCV: [], IDS: [] },
  };
}

export function MultipleSapSyncDialog({ open, onOpenChange, vendors, onConfirm, isSubmitting }: Props) {
  const [form, setForm] = useState<SapFieldOverrides>(() => buildCommonDefaults(null));
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setMissing([]);
    setForm(buildCommonDefaults(null));
    // Load tenant defaults from first vendor
    const tenantId = (vendors[0] as any)?.tenant_id;
    if (tenantId) {
      (async () => {
        const { data } = await supabase
          .from('sap_default_fields' as any)
          .select('*')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        setForm(buildCommonDefaults(data));
      })();
    }
  }, [open, vendors]);

  const set = <K extends keyof SapFieldOverrides>(k: K, v: SapFieldOverrides[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            Multiple SAP Sync — Common Fields
          </DialogTitle>
          <DialogDescription>
            These common SAP header fields will be applied to all selected vendors. Vendor-specific data
            (PAN, GST, MSME, address, classification) is derived per vendor automatically.
          </DialogDescription>
          <div className="flex flex-wrap gap-2 mt-2">
            {vendors.map(v => (
              <Badge key={v.id} variant="secondary" className="rounded-full">
                {v.legal_name || v.trade_name || v.id.slice(0, 8)}
              </Badge>
            ))}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh] pr-3">
          <div className="space-y-6 py-2">
            <Section icon={<Building2 className="h-4 w-4" />} title="Vendor Header">
              <SelectField label="Vendor (Person/Organization/Group)" value={form.partn_cat} onChange={v => set('partn_cat', v)}
                options={[['1', 'Person'], ['2', 'Organization'], ['3', 'Group']]} />
              <TextField label="Vendor Account Group *" value={form.partn_grp} onChange={v => set('partn_grp', v)} invalid={missing.includes('partn_grp')} />
              <TextField label="Title" value={form.title} onChange={v => set('title', v)} />
              <TextField label="Tax Type" value={form.taxtype} onChange={v => set('taxtype', v)} />
            </Section>

            <Separator />

            <Section icon={<Briefcase className="h-4 w-4" />} title="Company Code Data">
              <TextField label="Company Code *" value={form.bukrs} onChange={v => set('bukrs', v)} invalid={missing.includes('bukrs')} />
              <TextField label="Rec-Account *" value={form.akont} onChange={v => set('akont', v)} invalid={missing.includes('akont')} />
              <TextField label="Sort Key" value={form.zuawa} onChange={v => set('zuawa', v)} />
              <TextField label="Planning Group *" value={form.fdgrv} onChange={v => set('fdgrv', v)} invalid={missing.includes('fdgrv')} />
            </Section>

            <Separator />

            <Section icon={<ShoppingCart className="h-4 w-4" />} title="Purchase Data">
              <TextField label="Purchase Org *" value={form.vkorg} onChange={v => set('vkorg', v)} invalid={missing.includes('vkorg')} />
              <TextField label="Currency *" value={form.waers} onChange={v => set('waers', v)} invalid={missing.includes('waers')} />
              <TextField label="Group for Calc Schema (Supplier)" value={form.kalsk} onChange={v => set('kalsk', v)} />
              <TextField label="Vendor Class" value={form.ven_class} onChange={v => set('ven_class', v)} />
            </Section>

            <Separator />

            <Section icon={<FileCheck2 className="h-4 w-4" />} title="Invoice Verification & Duplicates">
              <CheckboxField label="GR-Based Invoice Verification" checked={form.webre === 'X'} onChange={v => set('webre', v ? 'X' : '')} />
              <CheckboxField label="Service-Based Invoice Verification" checked={form.lebre === 'X'} onChange={v => set('lebre', v ? 'X' : '')} />
              <CheckboxField label="Check Duplicate Invoice" checked={form.cdi === 'X'} onChange={v => set('cdi', v ? 'X' : '')} />
            </Section>
          </div>
        </ScrollArea>

        {missing.length > 0 && (
          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            Please fill required fields: {missing.map(k => REQUIRED_LABELS[k]).join(', ')}.
          </div>
        )}

        <DialogFooter className="gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const miss = REQUIRED_KEYS.filter(k => !String((form as any)[k] ?? '').trim());
              setMissing(miss as string[]);
              if (miss.length === 0) onConfirm(form);
            }}
            disabled={isSubmitting}
            className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-blue-500/20"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing {vendors.length}…</>
            ) : (
              <><Server className="h-4 w-4 mr-2" />Sync Multiple to SAP ({vendors.length})</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="font-semibold flex items-center gap-2 text-primary">{icon}{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function TextField({ label, value, onChange, invalid }: { label: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} className={`h-9 rounded-lg ${invalid ? 'border-destructive ring-1 ring-destructive' : ''}`} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value || '__empty__'} onValueChange={v => onChange(v === '__empty__' ? '' : v)}>
        <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map(([v, l]) => (
            <SelectItem key={v || '__empty__'} value={v || '__empty__'}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2 pt-5">
      <Checkbox checked={checked} onCheckedChange={v => onChange(!!v)} />
      <Label className="text-sm cursor-pointer" onClick={() => onChange(!checked)}>{label}</Label>
    </div>
  );
}
