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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Server, Loader2, Building2, Briefcase, ShoppingCart, FileCheck2, AlertCircle, CheckCircle2, Tags } from 'lucide-react';
import type { VendorRow } from '@/hooks/useVendors';
import { supabase } from '@/integrations/supabase/client';
import { useRefreshSapMaster } from '@/hooks/useSapMasterData';
import { getSapName1 } from '@/lib/sapPayloadBuilder';
import { formatVendorName, toProperCase } from '@/lib/textCase';
import { SapF4SelectField, SapF4MultiSelectField, WithholdingTaxSection, type SapFieldOverrides } from './SapFieldsDialog';

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
    msme: '',
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
    reg_addr1: '', reg_addr2: '', reg_addr3: '', reg_addr4: '',
    reg_city: '', reg_state: '', reg_pincode: '',
    reg_contact1: '', reg_contact2: '', reg_email1: '', reg_email2: '',
    reg_is_msme: false, reg_msme_no: '', reg_msme_cat: '', reg_msme_act: '',
    classify: { MGV: [], CATV: [], LOCV: [], IDS: [], CASH: [], TIER: [] },
    withholding: [],
  };
}

export function MultipleSapSyncDialog({ open, onOpenChange, vendors, onConfirm, isSubmitting }: Props) {
  const [form, setForm] = useState<SapFieldOverrides>(() => buildCommonDefaults(null));
  const [classifyMode, setClassifyMode] = useState<'details' | 'cfstmt'>('details');
  const [missing, setMissing] = useState<string[]>([]);
  const [f4Status, setF4Status] = useState<{ state: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ state: 'idle', message: '' });
  const [liveF4, setLiveF4] = useState<Record<string, any[]> | null>(null);
  const [wtAll, setWtAll] = useState<Array<{ LAND1: string; TAXTYPE: string; TEXT40: string }>>([]);
  const [wtLoading, setWtLoading] = useState(false);
  const [wtError, setWtError] = useState<string | null>(null);
  const [wtcAll, setWtcAll] = useState<Array<{ LAND1: string; WITHT: string; WT_WITHCD: string; TCDESC: string }>>([]);
  const [wtrAll, setWtrAll] = useState<Array<{ LAND1: string; WITHT: string; QSREC: string; RCTXT: string }>>([]);
  const [wtcLoading, setWtcLoading] = useState(false);
  const [wtcError, setWtcError] = useState<string | null>(null);
  const refreshMaster = useRefreshSapMaster();

  // Common country across selected vendors (blank if mixed)
  const commonCountry = (() => {
    const countries = new Set<string>();
    for (const v of vendors) {
      const anyV: any = v;
      const isIntl = String(anyV.vendor_type || 'domestic') === 'international';
      const c = isIntl
        ? (anyV.international_data?.company?.country || anyV.international_data?.address?.country || anyV.country || anyV.reg_country || '')
        : 'IN';
      countries.add(String(c || '').trim().toUpperCase());
    }
    return countries.size === 1 ? [...countries][0] : '';
  })();

  const wtFiltered = commonCountry
    ? wtAll.filter((r) => String(r.LAND1 || '').trim().toUpperCase() === commonCountry)
    : wtAll;

  const fetchWtTypes = async () => {
    setWtLoading(true);
    setWtError(null);
    try {
      const { data, error } = await supabase.functions.invoke('sap-fetch-withholding-tax', {
        body: { config_name: 'Fetch_Withholding_TaxType' },
      });
      if (error) setWtError(error.message || 'Failed to load withholding tax types');
      else if (data?.success) {
        const records = Array.isArray(data.records) ? data.records : Array.isArray(data.raw) ? data.raw : [];
        const norm = records.map((r: any) => {
          const get = (k: string) => {
            for (const key of Object.keys(r || {})) if (key.toLowerCase() === k.toLowerCase()) return r[key];
            return '';
          };
          return {
            LAND1: String(get('LAND1') || '').trim().toUpperCase(),
            TAXTYPE: String(get('TAXTYPE') || '').trim(),
            TEXT40: String(get('TEXT40') || '').trim(),
          };
        }).filter((r: any) => r.TAXTYPE);
        setWtAll(norm);
      } else setWtError(data?.message || 'Failed to load withholding tax types');
    } catch (e: any) {
      setWtError(e?.message || 'Failed to load withholding tax types');
    } finally {
      setWtLoading(false);
    }
  };

  const fetchWtCodesRectypes = async () => {
    setWtcLoading(true);
    setWtcError(null);
    try {
      const { data, error } = await supabase.functions.invoke('sap-fetch-wtx-code-rectype', {
        body: { config_name: 'Fetch_Withholding_WTX_Code_REC_Type' },
      });
      if (error) setWtcError(error.message || 'Failed to load WTax Code / Rec.Type');
      else if (data?.success) {
        setWtcAll(Array.isArray(data.taxcodes) ? data.taxcodes : []);
        setWtrAll(Array.isArray(data.rectypes) ? data.rectypes : []);
      } else setWtcError(data?.message || 'Failed to load WTax Code / Rec.Type');
    } catch (e: any) {
      setWtcError(e?.message || 'Failed to load WTax Code / Rec.Type');
    } finally {
      setWtcLoading(false);
    }
  };


  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMissing([]);
    setForm(buildCommonDefaults(null));
    setClassifyMode('details');
    setLiveF4(null);
    setWtAll([]);
    setWtcAll([]);
    setWtrAll([]);
    fetchWtTypes();
    fetchWtCodesRectypes();

    const tenantId = (vendors[0] as any)?.tenant_id;
    if (tenantId) {
      (async () => {
        const { data } = await supabase
          .from('sap_default_fields' as any)
          .select('*')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (!cancelled) setForm(buildCommonDefaults(data));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
            Multiple SAP Sync — Common Fields
          </DialogTitle>
          <DialogDescription>
            These common SAP header fields will be applied to all selected vendors. Vendor-specific data
            (PAN, GST, MSME, address, classification) is derived per vendor automatically.
          </DialogDescription>
          <div className="flex flex-wrap gap-2 mt-2">
            {vendors.map(v => (
              <Badge key={v.id} variant="secondary" className="rounded-full">
                {getSapName1(v) || v.legal_name || v.trade_name || v.id.slice(0, 8)}
              </Badge>
            ))}
          </div>
          {f4Status.state !== 'idle' && (
            <div className={`mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${f4Status.state === 'error' ? 'border-destructive/30 text-destructive' : 'border-border text-muted-foreground'}`}>
              {f4Status.state === 'loading' ? <Loader2 className="mt-0.5 h-3.5 w-3.5 animate-spin" /> : f4Status.state === 'error' ? <AlertCircle className="mt-0.5 h-3.5 w-3.5" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-primary" />}
              <span>{f4Status.message}</span>
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 260px)' }}>
          {f4Status.state === 'loading' ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-sm font-medium">Calling SAP Fields F4 API…</div>
              <div className="text-xs">Please wait while we fetch the latest dropdown options from SAP.</div>
            </div>
          ) : (
          <div className="space-y-6 py-2">
            <Section icon={<Building2 className="h-4 w-4" />} title="Vendor Header">
              <SelectField label="Vendor (Person/Organization/Group)" value={form.partn_cat} onChange={v => set('partn_cat', v)}
                options={[['1', 'Person'], ['2', 'Organization'], ['3', 'Group']]} />
              <SapF4SelectField label="Vendor Account Group" masterType="vendor_account_group" value={form.partn_grp} onChange={v => set('partn_grp', v)} liveItems={liveF4?.VENDOR_ACC_GRP} placeholder="Select Vendor Account Group" required invalid={missing.includes('partn_grp')} />
              <TextField label="Title" value={form.title} onChange={v => set('title', v)} />
              <TextField label="Tax Type" value={form.taxtype} onChange={v => set('taxtype', v)} />
            </Section>

            <Separator />

            <Section icon={<Briefcase className="h-4 w-4" />} title="Company Code Data">
              <SapF4SelectField label="Company Code" masterType="company_code" value={form.bukrs} onChange={v => set('bukrs', v)} liveItems={liveF4?.COMPANY_CODE} placeholder="Select Company Code" required invalid={missing.includes('bukrs')} />
              <SapF4SelectField label="Rec-Account" masterType="recon_account" value={form.akont} onChange={v => set('akont', v)} liveItems={liveF4?.RECON_ACCOUNT} placeholder="Select Rec-Account" required invalid={missing.includes('akont')} filter={{ key: 'BUKRS', value: form.bukrs, emptyHint: 'Select Company Code first' }} />
              <TextField label="Sort Key" value={form.zuawa} onChange={v => set('zuawa', v)} />
              <SapF4SelectField label="Planning Group" masterType="planning_group" value={form.fdgrv} onChange={v => set('fdgrv', v)} liveItems={liveF4?.PLANNING_GROUP} placeholder="Select Planning Group" required invalid={missing.includes('fdgrv')} />
            </Section>

            <Separator />

            <Section icon={<ShoppingCart className="h-4 w-4" />} title="Purchase Data">
              <SapF4SelectField label="Purchase Org" masterType="purchase_org" value={form.vkorg} onChange={v => set('vkorg', v)} liveItems={liveF4?.PURCHASE_ORG} placeholder="Select Purchase Org" required invalid={missing.includes('vkorg')} />
              <SapF4SelectField label="Currency" masterType="currency" value={form.waers} onChange={v => set('waers', v)} liveItems={liveF4?.CURRENCY} placeholder="Select Currency" required invalid={missing.includes('waers')} />
              <TextField label="Group for Calc Schema (Supplier)" value={form.kalsk} onChange={v => set('kalsk', v)} />
              <TextField label="Vendor Class" value={form.ven_class} onChange={v => set('ven_class', v)} />
            </Section>

            <Separator />

            <Section icon={<FileCheck2 className="h-4 w-4" />} title="Invoice Verification & Duplicates">
              <CheckboxField label="GR-Based Invoice Verification" checked={form.webre === 'X'} onChange={v => set('webre', v ? 'X' : '')} />
              <CheckboxField label="Service-Based Invoice Verification" checked={form.lebre === 'X'} onChange={v => set('lebre', v ? 'X' : '')} />
              <CheckboxField label="Check Duplicate Invoice" checked={form.cdi === 'X'} onChange={v => set('cdi', v ? 'X' : '')} />
            </Section>

            <Separator />

            <WithholdingTaxSection
              country={commonCountry}
              rows={form.withholding}
              onChange={(rows) => set('withholding', rows)}
              options={wtFiltered}
              allOptions={wtAll}
              loading={wtLoading}
              error={wtError}
              onRetry={fetchWtTypes}
              taxcodesAll={wtcAll}
              rectypesAll={wtrAll}
              codeLoading={wtcLoading}
              codeError={wtcError}
              onCodeRetry={fetchWtCodesRectypes}
            />

            <Separator />

            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2 text-primary">
                <Tags className="h-4 w-4" />Classification
              </h4>
              <RadioGroup
                value={classifyMode}
                onValueChange={(v) => setClassifyMode(v as 'details' | 'cfstmt')}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="mclassify-details" value="details" />
                  <Label htmlFor="mclassify-details" className="text-sm cursor-pointer">Vendor_Details</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="mclassify-cfstmt" value="cfstmt" />
                  <Label htmlFor="mclassify-cfstmt" className="text-sm cursor-pointer">Vendor_CFSTMT</Label>
                </div>
              </RadioGroup>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`border border-border rounded-lg p-4 space-y-3 ${classifyMode !== 'details' ? 'opacity-50 pointer-events-none' : ''}`}>
                  <h5 className="text-sm font-medium text-primary">Vendor_Details</h5>
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
                </div>
                <div className={`border border-border rounded-lg p-4 space-y-3 ${classifyMode !== 'cfstmt' ? 'opacity-50 pointer-events-none' : ''}`}>
                  <h5 className="text-sm font-medium text-primary">Vendor_CFSTMT</h5>
                  <SapF4MultiSelectField
                    label="Vendor Cash Flow"
                    masterType="vendor_cashflow"
                    value={form.classify.CASH || []}
                    onChange={(v) => setClassify('CASH', v)}
                    liveItems={liveF4?.CFSTMT}
                    placeholder="Select cash flow"
                  />
                  <SapF4MultiSelectField
                    label="Tier Category"
                    masterType="tier_category"
                    value={form.classify.TIER || []}
                    onChange={(v) => setClassify('TIER', v)}
                    liveItems={liveF4?.CP_TIER}
                    placeholder="Select tier category"
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Only the selected group is sent to SAP; the other group is sent as empty. Your selections in the other group are preserved.
              </p>
            </div>
          </div>
          )}
        </div>


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
              if (miss.length === 0) {
                const finalClassify = classifyMode === 'details'
                  ? { ...form.classify, CASH: [], TIER: [] }
                  : { ...form.classify, MGV: [], CATV: [], LOCV: [], IDS: [] };
                // Strip per-vendor keys so payload builder falls back to each vendor's own DB values
                const stripKeys = [
                  'reg_addr1','reg_addr2','reg_addr3','reg_addr4',
                  'reg_city','reg_state','reg_pincode',
                  'reg_contact1','reg_contact2','reg_email1','reg_email2',
                  'reg_is_msme','reg_msme_no','reg_msme_cat','reg_msme_act',
                  'msme','idtype','idnum',
                ];
                const cleaned: any = { ...form, classify: finalClassify };
                for (const k of stripKeys) delete cleaned[k];
                onConfirm(cleaned);
              }
            }}
            disabled={isSubmitting || f4Status.state === 'loading'}
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

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
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
