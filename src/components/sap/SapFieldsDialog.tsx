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
import { Server, Loader2, Building2, Briefcase, ShoppingCart, Tag } from 'lucide-react';
import type { VendorRow } from '@/hooks/useVendors';
import { supabase } from '@/integrations/supabase/client';
import { PRODUCT_CATEGORIES, VENDOR_CATEGORIES, IDENTIFICATION_SOURCES, INDIAN_STATES } from '@/types/vendor';

export type SapFieldOverrides = {
  partn_cat: string; partn_grp: string; title: string; taxtype: string;
  msme: string; idtype: string; idnum: string;
  bukrs: string; akont: string; zuawa: string; cdi: string; fdgrv: string;
  vkorg: string; waers: string; kalsk: string; webre: string; lebre: string; ven_class: string;
  classify: { MGV: string; CATV: string; LOCV: string; IDS: string };
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendor: VendorRow | null;
  onConfirm: (overrides: SapFieldOverrides) => void;
  isSubmitting: boolean;
}

function isMsme(v: any): boolean {
  return !!(v?.msme_number) || v?.msme_verification_status === 'passed';
}

export function SapFieldsDialog({ open, onOpenChange, vendor, onConfirm, isSubmitting }: Props) {
  const [form, setForm] = useState<SapFieldOverrides>(() => buildDefaults(vendor, null));

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tenantId = (vendor as any)?.tenant_id;
    setForm(buildDefaults(vendor, null));
    if (tenantId) {
      (async () => {
        const { data } = await supabase
          .from('sap_default_fields' as any)
          .select('*')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (!cancelled) setForm(buildDefaults(vendor, data));
      })();
    }
    return () => { cancelled = true; };
  }, [open, vendor]);

  const set = <K extends keyof SapFieldOverrides>(k: K, v: SapFieldOverrides[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const setClassify = (k: keyof SapFieldOverrides['classify'], v: string) =>
    setForm(prev => ({ ...prev, classify: { ...prev.classify, [k]: v } }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            SAP Field Confirmation
          </DialogTitle>
          <DialogDescription>
            Review and confirm SAP-specific fields before pushing this vendor to S/4HANA.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 220px)' }}>
          <div className="space-y-6 py-2">
            {/* Vendor Header */}
            <Section icon={<Building2 className="h-4 w-4" />} title="Vendor Header">
              <SelectField label="Vendor (Person/Organization/Group)" value={form.partn_cat} onChange={v => set('partn_cat', v)}
                options={[['1', 'Person'], ['2', 'Organization'], ['3', 'Group']]} />
              <TextField label="Vendor Account Group" value={form.partn_grp} onChange={v => set('partn_grp', v)} />
              <SelectField label="MSME (Minority Indicator)" value={form.msme} onChange={v => set('msme', v)}
                options={[['', 'None'], ['MIC', 'MIC']]} />
            </Section>

            <Separator />

            {/* Company Code Data */}
            <Section icon={<Briefcase className="h-4 w-4" />} title="Company Code Data">
              <TextField label="Company Code" value={form.bukrs} onChange={v => set('bukrs', v)} />
              <TextField label="Rec-Account" value={form.akont} onChange={v => set('akont', v)} />
              <TextField label="Sort Key" value={form.zuawa} onChange={v => set('zuawa', v)} />
              <TextField label="Planning Group" value={form.fdgrv} onChange={v => set('fdgrv', v)} />
              <CheckboxField label="Check Duplicate Invoice" checked={form.cdi === 'X'}
                onChange={v => set('cdi', v ? 'X' : '')} />
            </Section>

            <Separator />

            {/* Purchase Data */}
            <Section icon={<ShoppingCart className="h-4 w-4" />} title="Purchase Data">
              <TextField label="Purchase Org" value={form.vkorg} onChange={v => set('vkorg', v)} />
              <TextField label="Currency" value={form.waers} onChange={v => set('waers', v)} />
              <TextField label="Group for Calc Schema (Supplier)" value={form.kalsk} onChange={v => set('kalsk', v)} />
              <TextField label="Vendor Class" value={form.ven_class} onChange={v => set('ven_class', v)} />
              <CheckboxField label="GR-Based Invoice Verification" checked={form.webre === 'X'}
                onChange={v => set('webre', v ? 'X' : '')} />
              <CheckboxField label="Service-Based Invoice Verification" checked={form.lebre === 'X'}
                onChange={v => set('lebre', v ? 'X' : '')} />
            </Section>

          </div>
        </div>

        <DialogFooter className="gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(form)}
            disabled={isSubmitting}
            className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-blue-500/20"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</>
            ) : (
              <><Server className="h-4 w-4 mr-2" />Sync to SAP</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildDefaults(vendor: VendorRow | null, tenantDefaults: any | null): SapFieldOverrides {
  const msme = isMsme(vendor);
  const d = tenantDefaults || {};
  return {
    partn_cat: d.partn_cat ?? '2',
    partn_grp: d.partn_grp ?? 'ZDOM',
    title: d.title ?? '0003',
    taxtype: d.taxtype ?? 'IN3',
    msme: msme ? 'MIC' : '',
    idtype: msme ? 'ZMSMEN' : '',
    idnum: (vendor as any)?.msme_number || '',
    bukrs: d.bukrs ?? '1000',
    akont: d.akont ?? '155000005',
    zuawa: d.zuawa ?? '014',
    cdi: d.cdi ?? 'X',
    fdgrv: d.fdgrv ?? 'A1',
    vkorg: d.vkorg ?? '1000',
    waers: d.waers ?? 'INR',
    kalsk: d.kalsk ?? 'L1',
    webre: d.webre ?? 'X',
    lebre: d.lebre ?? 'X',
    ven_class: d.ven_class ?? '',
    classify: {
      MGV: '',
      CATV: '',
      LOCV: vendor?.registered_state || '',
      IDS: '',
    },
  };
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="font-semibold flex items-center gap-2 text-primary">{icon}{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

function TextField({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={`space-y-1 ${className || ''}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} className="h-9 rounded-lg" />
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
