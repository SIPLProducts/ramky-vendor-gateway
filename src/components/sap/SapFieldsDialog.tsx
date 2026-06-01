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
import { MultiSelect } from '@/components/ui/multi-select';
import { Server, Loader2, Building2, Briefcase, ShoppingCart, Landmark, Tags, MapPin, Phone, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { VendorRow } from '@/hooks/useVendors';
import { supabase } from '@/integrations/supabase/client';
import { useRefreshSapMaster, useSapMasterData } from '@/hooks/useSapMasterData';

export type SapFieldOverrides = {
  partn_cat: string; partn_grp: string; title: string; taxtype: string;
  msme: string; idtype: string; idnum: string;
  bukrs: string; akont: string; zuawa: string; cdi: string; fdgrv: string;
  vkorg: string; waers: string; kalsk: string; webre: string; lebre: string; ven_class: string;
  classify: { MGV: string[]; CATV: string[]; LOCV: string[]; IDS: string[] };
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

const REQUIRED_KEYS: Array<keyof SapFieldOverrides> = ['partn_grp', 'bukrs', 'akont', 'fdgrv', 'vkorg', 'waers'];
const REQUIRED_LABELS: Record<string, string> = {
  partn_grp: 'Vendor Account Group',
  bukrs: 'Company Code',
  akont: 'Rec-Account',
  fdgrv: 'Planning Group',
  vkorg: 'Purchase Org',
  waers: 'Currency',
};

export function SapFieldsDialog({ open, onOpenChange, vendor, onConfirm, isSubmitting }: Props) {
  const [form, setForm] = useState<SapFieldOverrides>(() => buildDefaults(vendor, null));
  const [f4Status, setF4Status] = useState<{ state: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ state: 'idle', message: '' });
  const [liveF4, setLiveF4] = useState<Record<string, any[]> | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const refreshMaster = useRefreshSapMaster();

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tenantId = (vendor as any)?.tenant_id;
    setForm(buildDefaults(vendor, null));
    setLiveF4(null);
    setMissingFields([]);
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
    setF4Status({ state: 'loading', message: 'Calling SAP Fields F4 API… please wait.' });
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) {
        setF4Status((prev) => prev.state === 'loading'
          ? { state: 'loading', message: 'SAP Fields F4 API is taking longer than expected. Still waiting…' }
          : prev);
      }
    }, 60000);
    (async () => {
      try {
        const res: any = await refreshMaster.mutateAsync(undefined);
        if (cancelled) return;
        window.clearTimeout(slowTimer);
        if (res?.success) {
          if (res.sap_response && typeof res.sap_response === 'object') {
            setLiveF4(res.sap_response as Record<string, any[]>);
          }
          const total = Object.values(res.summary || {}).reduce((s: number, v: any) => s + (v.upserted || 0), 0);
          setF4Status({ state: 'success', message: `${total} F4 options loaded from SAP Fields F4 API.` });
        } else {
          const hint = res?.hint ? ` ${res.hint}` : '';
          setF4Status({ state: 'error', message: `${res?.message || 'SAP Fields F4 refresh failed.'}${hint} Showing cached F4 options if available.` });
        }
      } catch (e: any) {
        window.clearTimeout(slowTimer);
        if (!cancelled) setF4Status({ state: 'error', message: `${e?.message || 'SAP Fields F4 refresh failed.'} Showing cached F4 options if available.` });
      }
    })();
    return () => { cancelled = true; window.clearTimeout(slowTimer); };
  }, [open, vendor]);

  const set = <K extends keyof SapFieldOverrides>(k: K, v: SapFieldOverrides[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const setClassify = (k: keyof SapFieldOverrides['classify'], v: string[]) =>
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
          {f4Status.state !== 'idle' && (
            <div className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${f4Status.state === 'error' ? 'border-destructive/30 text-destructive' : 'border-border text-muted-foreground'}`}>
              {f4Status.state === 'loading' ? <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin" /> : f4Status.state === 'error' ? <AlertCircle className="mt-0.5 h-3.5 w-3.5" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-primary" />}
              <span>{f4Status.message}</span>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 220px)' }}>
          {f4Status.state === 'loading' ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-sm font-medium">Calling SAP Fields F4 API…</div>
              <div className="text-xs">Please wait while we fetch the latest dropdown options from SAP.</div>
            </div>
          ) : (
          <div className="space-y-6 py-2">
            {/* Vendor Information (read-only) */}
            <Section icon={<Building2 className="h-4 w-4" />} title="Vendor Information">
              <ReadOnlyField label="Trade Name" value={(vendor as any)?.trade_name} />
              <ReadOnlyField label="GST ID (GSTIN)" value={(vendor as any)?.gstin} />
              <ReadOnlyField label="PAN Number" value={(vendor as any)?.pan} />
              <ReadOnlyField label="Udyam Number (MSME)" value={(vendor as any)?.msme_number} />
            </Section>

            <Separator />

            {/* Bank Details (read-only) */}
            <Section icon={<Landmark className="h-4 w-4" />} title="Bank Details">
              <ReadOnlyField label="Bank Account Number" value={(vendor as any)?.account_number} />
              <ReadOnlyField label="Bank ID (IFSC Code)" value={(vendor as any)?.ifsc_code} />
              <ReadOnlyField label="Account Holder Name" value={(vendor as any)?.account_holder_name} />
              <ReadOnlyField label="Bank Name" value={(vendor as any)?.bank_name} />
            </Section>

            <Separator />

            {/* Registered / Corporate Office Address (read-only) */}
            <Section icon={<MapPin className="h-4 w-4" />} title="Registered / Corporate Office Address">
              <ReadOnlyField label="Address Line 1" value={(vendor as any)?.registered_address} />
              <ReadOnlyField label="Address Line 2" value={(vendor as any)?.registered_address_line2} />
              <ReadOnlyField label="Address Line 3" value={(vendor as any)?.registered_address_line3} />
              <ReadOnlyField label="Address Line 4" value={(vendor as any)?.registered_address_line4} />
              <ReadOnlyField label="City" value={(vendor as any)?.registered_city} />
              <ReadOnlyField label="State" value={(vendor as any)?.registered_state} />
              <ReadOnlyField label="Pincode" value={(vendor as any)?.registered_pincode} />
              <ReadOnlyField label="Phone" value={(vendor as any)?.registered_phone} />
            </Section>

            <Separator />

            {/* Contact Details (read-only) */}
            <Section icon={<Phone className="h-4 w-4" />} title="Contact Details">
              <ReadOnlyField label="Contact Number" value={(vendor as any)?.primary_phone || (vendor as any)?.registered_phone} />
              <ReadOnlyField label="Email ID" value={(vendor as any)?.primary_email || (vendor as any)?.registered_email} />
            </Section>

            <Separator />

            {/* Vendor Header (editable SAP) */}
            <Section icon={<Building2 className="h-4 w-4" />} title="Vendor Header">
              <SelectField label="Vendor (Person/Organization/Group)" value={form.partn_cat} onChange={v => set('partn_cat', v)}
                options={[['1', 'Person'], ['2', 'Organization'], ['3', 'Group']]} />
              <SapF4SelectField label="Vendor Account Group" masterType="vendor_account_group" value={form.partn_grp} onChange={v => set('partn_grp', v)} liveItems={liveF4?.VENDOR_ACC_GRP} placeholder="Select Vendor Account Group" required invalid={missingFields.includes('partn_grp')} />
              <SelectField label="MSME (Minority Indicator)" value={form.msme} onChange={v => set('msme', v)}
                options={[['', 'None'], ['MIC', 'MIC']]} />
            </Section>

            <Separator />

            {/* Company Code Data */}
            <Section icon={<Briefcase className="h-4 w-4" />} title="Company Code Data">
              <SapF4SelectField label="Company Code" masterType="company_code" value={form.bukrs} onChange={v => set('bukrs', v)} liveItems={liveF4?.COMPANY_CODE} placeholder="Select Company Code" required invalid={missingFields.includes('bukrs')} />
              <SapF4SelectField label="Rec-Account" masterType="recon_account" value={form.akont} onChange={v => set('akont', v)} liveItems={liveF4?.RECON_ACCOUNT} placeholder="Select Rec-Account" required invalid={missingFields.includes('akont')} filter={{ key: 'BUKRS', value: form.bukrs, emptyHint: 'Select Company Code first' }} />
              <TextField label="Sort Key" value={form.zuawa} onChange={v => set('zuawa', v)} />
              <SapF4SelectField label="Planning Group" masterType="planning_group" value={form.fdgrv} onChange={v => set('fdgrv', v)} liveItems={liveF4?.PLANNING_GROUP} placeholder="Select Planning Group" required invalid={missingFields.includes('fdgrv')} />
              <CheckboxField label="Check Duplicate Invoice" checked={form.cdi === 'X'}
                onChange={v => set('cdi', v ? 'X' : '')} />
            </Section>

            <Separator />

            {/* Purchase Data */}
            <Section icon={<ShoppingCart className="h-4 w-4" />} title="Purchase Data">
              <SapF4SelectField label="Purchase Org" masterType="purchase_org" value={form.vkorg} onChange={v => set('vkorg', v)} liveItems={liveF4?.PURCHASE_ORG} placeholder="Select Purchase Org" required invalid={missingFields.includes('vkorg')} />
              <SapF4SelectField label="Currency" masterType="currency" value={form.waers} onChange={v => set('waers', v)} liveItems={liveF4?.CURRENCY} placeholder="Select Currency" required invalid={missingFields.includes('waers')} />
              <TextField label="Group for Calc Schema (Supplier)" value={form.kalsk} onChange={v => set('kalsk', v)} />
              <TextField label="Vendor Class" value={form.ven_class} onChange={v => set('ven_class', v)} />
              <CheckboxField label="GR-Based Invoice Verification" checked={form.webre === 'X'}
                onChange={v => set('webre', v ? 'X' : '')} />
              <CheckboxField label="Service-Based Invoice Verification" checked={form.lebre === 'X'}
                onChange={v => set('lebre', v ? 'X' : '')} />
            </Section>

            <Separator />

            {/* Classification — editable here (no longer captured during registration) */}
            <Section icon={<Tags className="h-4 w-4" />} title="Classification">
              <SapF4MultiSelectField
                label="Material Group for Vendors"
                masterType="material_group_vendor"
                value={form.classify.MGV || []}
                onChange={(v) => setClassify('MGV', v)}
                placeholder="Select material groups"
              />
              <SapF4MultiSelectField
                label="Vendor Category"
                masterType="vendor_category"
                value={form.classify.CATV || []}
                onChange={(v) => setClassify('CATV', v)}
                placeholder="Select vendor categories"
              />
              <SapF4MultiSelectField
                label="Vendor Location"
                masterType="vendor_location"
                value={form.classify.LOCV || []}
                onChange={(v) => setClassify('LOCV', v)}
                placeholder="Select locations"
              />
              <SapF4MultiSelectField
                label="Vendor Identification Source"
                masterType="identification_source"
                value={form.classify.IDS || []}
                onChange={(v) => setClassify('IDS', v)}
                placeholder="Select identification sources"
              />
              <p className="md:col-span-2 text-[11px] text-muted-foreground -mt-1">
                Select Classification values to send to SAP. Defaults are pre-filled when available.
              </p>
            </Section>


          </div>
          )}
        </div>

        {missingFields.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5" />
            <span>Please fill required SAP fields: {missingFields.map(k => REQUIRED_LABELS[k]).join(', ')}.</span>
          </div>
        )}

        <DialogFooter className="gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl" disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const missing = REQUIRED_KEYS.filter(k => !String((form as any)[k] ?? '').trim());
              setMissingFields(missing as string[]);
              if (missing.length === 0) onConfirm(form);
            }}
            disabled={isSubmitting || f4Status.state === 'loading'}
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
    partn_grp: d.partn_grp ?? '',
    title: d.title ?? '0003',
    taxtype: d.taxtype ?? 'IN3',
    msme: msme ? 'MIC' : '',
    idtype: msme ? 'ZMSMEN' : '',
    idnum: (vendor as any)?.msme_number || '',
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
    classify: {
      MGV: Array.isArray((vendor as any)?.material_group_vendors) ? (vendor as any).material_group_vendors : [],
      CATV: Array.isArray((vendor as any)?.vendor_categories) ? (vendor as any).vendor_categories : [],
      LOCV: Array.isArray((vendor as any)?.vendor_locations) ? (vendor as any).vendor_locations : [],
      IDS: Array.isArray((vendor as any)?.identification_sources) ? (vendor as any).identification_sources : [],
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

function ReadOnlyField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value == null || value === '' ? '—' : String(value)} disabled readOnly className="h-9 rounded-lg bg-muted/40 text-muted-foreground" />
    </div>
  );
}

const F4_FIELD_MAP: Record<string, { code: string; desc?: string; prefix?: string }> = {
  vendor_account_group:  { code: 'KTOKK', desc: 'TXT30' },
  company_code:          { code: 'BUKRS', desc: 'BUTXT' },
  planning_group:        { code: 'GRUPP' },
  recon_account:         { code: 'SAKNR', desc: 'TXT20', prefix: 'BUKRS' },
  purchase_org:          { code: 'EKORG', desc: 'EKOTX' },
  currency:              { code: 'WAERS', desc: 'LTEXT' },
  material_group_vendor: { code: 'ATWRT', desc: 'ATWTB' },
  vendor_category:       { code: 'ATWRT', desc: 'ATWTB' },
  vendor_location:       { code: 'ATWRT', desc: 'ATWTB' },
  identification_source: { code: 'ATWRT', desc: 'ATWTB' },
};

export function SapF4SelectField({
  label, masterType, value, onChange, liveItems, placeholder, required, invalid, filter,
}: {
  label: string;
  masterType: string;
  value: string;
  onChange: (v: string) => void;
  liveItems?: any[] | null;
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
  filter?: { key: string; value: string; emptyHint?: string };
}) {
  const map = F4_FIELD_MAP[masterType];
  const isLive = Array.isArray(liveItems);
  const { data: cachedRows, isLoading: isLoadingCache } = useSapMasterData(isLive ? undefined : masterType);

  const filterActive = !!filter;
  const filterReady = !filter || !!String(filter.value || '').trim();

  const options = (() => {
    if (!filterReady) return [] as { value: string; label: string }[];
    const matches = (extra: any) =>
      !filter || String(extra?.[filter.key] ?? '').trim() === String(filter.value).trim();

    let raw: { value: string; label: string }[] = [];
    if (isLive) {
      raw = (liveItems || [])
        .map((item) => {
          if (!matches(item)) return null;
          const code = map ? item?.[map.code] : item?.code;
          if (code === undefined || code === null || String(code).trim() === '') return null;
          const desc = map?.desc ? item?.[map.desc] : item?.description;
          const prefix = !filter && map?.prefix ? item?.[map.prefix] : null;
          const codePart = prefix ? `${prefix} / ${code}` : String(code);
          const labelText = desc ? `${codePart} — ${desc}` : codePart;
          return { value: String(code), label: labelText };
        })
        .filter(Boolean) as { value: string; label: string }[];
    } else {
      raw = (cachedRows || [])
        .map((r: any) => {
          const extra = r.extra || {};
          if (!matches(extra)) return null;
          const code = map ? (extra[map.code] ?? r.code) : r.code;
          const desc = map?.desc ? (extra[map.desc] ?? r.description) : r.description;
          const prefix = !filter && map?.prefix ? extra[map.prefix] : null;
          const codePart = prefix ? `${prefix} / ${code}` : String(code);
          const labelText = desc ? `${codePart} — ${desc}` : codePart;
          return { value: String(r.code ?? code), label: labelText };
        })
        .filter(Boolean) as { value: string; label: string }[];
    }
    // de-duplicate by value (first wins)
    const seen = new Set<string>();
    return raw.filter((o) => (seen.has(o.value) ? false : (seen.add(o.value), true)));
  })();

  // Clear selected value if it is no longer a valid option after filtering.
  useEffect(() => {
    if (!filterActive || !filterReady) return;
    if (!value) return;
    if (!options.some((o) => o.value === String(value))) {
      onChange('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterActive, filterReady, options.length, value]);

  const isLoading = isLive ? false : isLoadingCache;
  const showFilterHint = filterActive && !filterReady;

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Select value={value || undefined} onValueChange={(v) => onChange(v)} disabled={showFilterHint}>
        <SelectTrigger className={`h-9 rounded-lg ${invalid ? 'border-destructive ring-1 ring-destructive' : ''}`}>
          <SelectValue placeholder={showFilterHint ? (filter?.emptyHint || 'Select Company Code first') : (placeholder || 'Select…')} />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {showFilterHint
                ? (filter?.emptyHint || 'Select Company Code first')
                : isLoading ? 'Loading F4 values…' : 'No options available.'}
            </div>
          ) : (
            options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                <span className="font-mono text-xs">{o.label}</span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">
        {showFilterHint
          ? (filter?.emptyHint || 'Select Company Code first to load options.')
          : isLoading
            ? 'Loading F4 values…'
            : `${options.length} option${options.length === 1 ? '' : 's'} loaded${isLive ? ' from live SAP F4.' : '.'}`}
      </p>
    </div>
  );
}

export function SapF4MultiSelectField({
  label, masterType, value, onChange, liveItems, placeholder,
}: {
  label: string;
  masterType: string;
  value: string[];
  onChange: (v: string[]) => void;
  liveItems?: any[] | null;
  placeholder?: string;
}) {
  const map = F4_FIELD_MAP[masterType];
  const isLive = Array.isArray(liveItems);
  const { data: cachedRows, isLoading } = useSapMasterData(isLive ? undefined : masterType);

  const options = (() => {
    if (isLive) {
      return (liveItems || [])
        .map((item) => {
          const code = map ? item?.[map.code] : item?.code;
          if (code === undefined || code === null || String(code).trim() === '') return null;
          const desc = map?.desc ? item?.[map.desc] : item?.description;
          const labelText = desc ? `${code} — ${desc}` : String(code);
          return { value: String(code), label: labelText };
        })
        .filter(Boolean) as { value: string; label: string }[];
    }
    return (cachedRows || []).map((r: any) => {
      const extra = r.extra || {};
      const code = map ? (extra[map.code] ?? r.code) : r.code;
      const desc = map?.desc ? (extra[map.desc] ?? r.description) : r.description;
      const labelText = desc ? `${code} — ${desc}` : String(code);
      return { value: String(r.code), label: labelText };
    });
  })();

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <MultiSelect
        options={options}
        selected={value || []}
        onChange={onChange}
        placeholder={placeholder || 'Select…'}
      />
      <p className="text-[11px] text-muted-foreground">
        {isLoading
          ? 'Loading F4 values…'
          : `${options.length} option${options.length === 1 ? '' : 's'} loaded${isLive ? ' from live SAP F4.' : '.'}`}
      </p>
    </div>
  );
}

