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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Server, Loader2, Building2, Briefcase, Landmark, Tags, MapPin, AlertCircle, CheckCircle2, FileCheck, Receipt, Search, Plus, Trash2 } from 'lucide-react';
import type { VendorRow } from '@/hooks/useVendors';
import { supabase } from '@/integrations/supabase/client';
import { useRefreshSapMaster, useSapMasterData } from '@/hooks/useSapMasterData';
import { getLocationLabel } from '@/lib/stateToSapLocation';
import { getSapName1, getSapVenClass } from '@/lib/sapPayloadBuilder';
import { toProperCase } from '@/lib/textCase';

export type WTaxRow = {
  witht: string;
  text40: string;
  wt_withcd: string;
  wt_withcd_desc?: string;
  wt_subjct: boolean;
  qsrec: string;
  qsrec_desc?: string;
  qland: string;
};

export type SapFieldOverrides = {
  partn_cat: string; partn_grp: string; title: string; taxtype: string;
  msme: string; idtype: string; idnum: string;
  bukrs: string; akont: string; zuawa: string; cdi: string; fdgrv: string;
  vkorg: string; waers: string; kalsk: string; webre: string; lebre: string; ven_class: string;
  reg_addr1: string; reg_addr2: string; reg_addr3: string; reg_addr4: string;
  reg_city: string; reg_state: string; reg_pincode: string;
  reg_contact1: string; reg_contact2: string; reg_email1: string; reg_email2: string;
  reg_is_msme: boolean; reg_msme_no: string; reg_msme_cat: string; reg_msme_act: string;
  classify: { MGV: string[]; CATV: string[]; LOCV: string[]; IDS: string[]; CASH: string[]; TIER: string[] };
  withholding: WTaxRow[];
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
  const [classifyMode, setClassifyMode] = useState<'details' | 'cfstmt'>('details');
  const [f4Status, setF4Status] = useState<{ state: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ state: 'idle', message: '' });
  const [liveF4, setLiveF4] = useState<Record<string, any[]> | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [wtAll, setWtAll] = useState<Array<{ LAND1: string; TAXTYPE: string; TEXT40: string }>>([]);
  const [wtLoading, setWtLoading] = useState(false);
  const [wtError, setWtError] = useState<string | null>(null);
  const [wtcAll, setWtcAll] = useState<Array<{ LAND1: string; WITHT: string; WT_WITHCD: string; TCDESC: string }>>([]);
  const [wtrAll, setWtrAll] = useState<Array<{ LAND1: string; WITHT: string; QSREC: string; RCTXT: string }>>([]);
  const [wtcLoading, setWtcLoading] = useState(false);
  const [wtcError, setWtcError] = useState<string | null>(null);
  const refreshMaster = useRefreshSapMaster();
  const { data: vendorLocRows } = useSapMasterData('vendor_location');

  const vendorCountry = (() => {
    const v: any = vendor || {};
    const isIntl = String(v.vendor_type || 'domestic') === 'international';
    if (isIntl) {
      const c =
        v.international_data?.company?.country ||
        v.international_data?.address?.country ||
        v.country ||
        v.reg_country ||
        '';
      return String(c || '').trim().toUpperCase();
    }
    return 'IN';
  })();

  const wtFiltered = wtAll.filter(
    (r) => String(r.LAND1 || '').trim().toUpperCase() === vendorCountry,
  );

  const fetchWtTypes = async () => {
    setWtLoading(true);
    setWtError(null);
    try {
      const { data, error } = await supabase.functions.invoke('sap-fetch-withholding-tax', {
        body: { config_name: 'Fetch_Withholding_TaxType' },
      });
      if (error) {
        setWtError(error.message || 'Failed to load withholding tax types');
      } else if (data?.success) {
        const records = Array.isArray(data.records) ? data.records : Array.isArray(data.raw) ? data.raw : [];
        const norm = records
          .map((r: any) => {
            const get = (k: string) => {
              for (const key of Object.keys(r || {})) {
                if (key.toLowerCase() === k.toLowerCase()) return r[key];
              }
              return '';
            };
            return {
              LAND1: String(get('LAND1') || '').trim().toUpperCase(),
              TAXTYPE: String(get('TAXTYPE') || '').trim(),
              TEXT40: String(get('TEXT40') || '').trim(),
            };
          })
          .filter((r: any) => r.TAXTYPE);
        setWtAll(norm);
      } else {
        setWtError(data?.message || 'Failed to load withholding tax types');
      }
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
      if (error) {
        setWtcError(error.message || 'Failed to load WTax Code / Rec.Type');
      } else if (data?.success) {
        setWtcAll(Array.isArray(data.taxcodes) ? data.taxcodes : []);
        setWtrAll(Array.isArray(data.rectypes) ? data.rectypes : []);
      } else {
        setWtcError(data?.message || 'Failed to load WTax Code / Rec.Type');
      }
    } catch (e: any) {
      setWtcError(e?.message || 'Failed to load WTax Code / Rec.Type');
    } finally {
      setWtcLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const tenantId = (vendor as any)?.tenant_id;
    const initial = buildDefaults(vendor, null);
    setForm(initial);
    const hasCfstmt = (initial.classify.CASH?.length || 0) + (initial.classify.TIER?.length || 0) > 0;
    const hasDetails = (initial.classify.MGV?.length || 0) + (initial.classify.CATV?.length || 0) > 0;
    setClassifyMode(hasCfstmt && !hasDetails ? 'cfstmt' : 'details');
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

    // Fetch Withholding Tax types via saved SAP API config "Fetch_Withholding_TaxType"
    setWtAll([]);
    fetchWtTypes();
    // Fetch WTax Code + Rec.Type via "Fetch_Withholding_WTX_Code_REC_Type"
    setWtcAll([]);
    setWtrAll([]);
    fetchWtCodesRectypes();


    return () => { cancelled = true; window.clearTimeout(slowTimer); };
  }, [open, vendor]);

  const set = <K extends keyof SapFieldOverrides>(k: K, v: SapFieldOverrides[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const setClassify = (k: keyof SapFieldOverrides['classify'], v: string[]) =>
    setForm(prev => ({ ...prev, classify: { ...prev.classify, [k]: v } }));

  const handleClassifyModeChange = (mode: 'details' | 'cfstmt') => {
    setClassifyMode(mode);
  };


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
              <ReadOnlyField label="SAP Name (NAME1)" value={getSapName1(vendor)} />
              <ReadOnlyField label="Trade Name" value={(vendor as any)?.trade_name} />
              <ReadOnlyField label="GST ID (GSTIN)" value={(vendor as any)?.gstin} />
              <ReadOnlyField label="PAN Number" value={(vendor as any)?.pan} />
              <ReadOnlyField label="Udyam Number (MSME)" value={(vendor as any)?.msme_number} />
              <div className="space-y-1">
                <ReadOnlyField label="Vendor Class (VEN_CLASS)" value={form.ven_class} />
                <p className="text-[10px] text-muted-foreground">Auto: empty when GST is present, "0" otherwise.</p>
              </div>
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

            {/* Registered / Corporate Office Address (editable) */}
            <Section icon={<MapPin className="h-4 w-4" />} title="Registered / Corporate Office Address">
              <TextField label="Address Line 1" value={form.reg_addr1} onChange={v => set('reg_addr1', v)} />
              <TextField label="Address Line 2" value={form.reg_addr2} onChange={v => set('reg_addr2', v)} />
              <TextField label="Address Line 3" value={form.reg_addr3} onChange={v => set('reg_addr3', v)} />
              <TextField label="Address Line 4" value={form.reg_addr4} onChange={v => set('reg_addr4', v)} />
              <TextField label="City" value={form.reg_city} onChange={v => set('reg_city', v)} />
              <TextField label="State" value={form.reg_state} onChange={v => set('reg_state', v)} />
              <TextField label="Pincode" value={form.reg_pincode} onChange={v => set('reg_pincode', v)} />
              <TextField label="Contact 1" value={form.reg_contact1} onChange={v => set('reg_contact1', v)} />
              <TextField label="Contact 2" value={form.reg_contact2} onChange={v => set('reg_contact2', v)} />
              <TextField label="Email 1" value={form.reg_email1} onChange={v => set('reg_email1', v)} />
              <TextField label="Email 2" value={form.reg_email2} onChange={v => set('reg_email2', v)} />
            </Section>

            <Separator />

            {/* MSME (read-only — sourced from vendor registration record) */}
            <Section icon={<FileCheck className="h-4 w-4" />} title="MSME Details">
              <ReadOnlyField label="MSME Registered" value={form.reg_is_msme ? 'Yes' : 'No'} />
              <ReadOnlyField label="Udyam / MSME Number" value={form.reg_is_msme ? form.reg_msme_no : ''} />
              <ReadOnlyField
                label="MSME Category"
                value={
                  form.reg_msme_cat
                    ? ({ micro: 'Micro', small: 'Small', medium: 'Medium' } as Record<string, string>)[
                        String(form.reg_msme_cat).toLowerCase()
                      ] || form.reg_msme_cat
                    : ''
                }
              />
              <ReadOnlyField
                label="Major Activity (IDCATG)"
                value={form.reg_is_msme ? form.reg_msme_act : ''}
              />
              <p className="md:col-span-2 text-[11px] text-muted-foreground -mt-1">
                MSME details are taken from the vendor registration record and pushed to SAP as-is.
              </p>
            </Section>

            <Separator />


            {/* Vendor Header (editable SAP) */}
            <Section icon={<Building2 className="h-4 w-4" />} title="Vendor Header">
              <SelectField label="Vendor (Person/Organization/Group)" value={form.partn_cat} onChange={v => set('partn_cat', v)}
                options={[['1', 'Person'], ['2', 'Organization'], ['3', 'Group']]} />
              <SapF4SelectField label="Vendor Account Group" masterType="vendor_account_group" value={form.partn_grp} onChange={v => set('partn_grp', v)} liveItems={liveF4?.VENDOR_ACC_GRP} placeholder="Select Vendor Account Group" required invalid={missingFields.includes('partn_grp')} />
            </Section>

            <Separator />

            {/* Company Code Data (now also includes former Purchase Data fields + MSME indicator) */}
            <Section icon={<Briefcase className="h-4 w-4" />} title="Company Code Data">
              <SapF4SelectField label="Company Code" masterType="company_code" value={form.bukrs} onChange={v => set('bukrs', v)} liveItems={liveF4?.COMPANY_CODE} placeholder="Select Company Code" required invalid={missingFields.includes('bukrs')} />
              <SapF4SelectField label="Rec-Account" masterType="recon_account" value={form.akont} onChange={v => set('akont', v)} liveItems={liveF4?.RECON_ACCOUNT} placeholder="Select Rec-Account" required invalid={missingFields.includes('akont')} filter={{ key: 'BUKRS', value: form.bukrs, emptyHint: 'Select Company Code first' }} />
              <TextField label="Sort Key" value={form.zuawa} onChange={v => set('zuawa', v)} />
              <SapF4SelectField label="Planning Group" masterType="planning_group" value={form.fdgrv} onChange={v => set('fdgrv', v)} liveItems={liveF4?.PLANNING_GROUP} placeholder="Select Planning Group" required invalid={missingFields.includes('fdgrv')} />
              <SapF4SelectField label="Purchase Org" masterType="purchase_org" value={form.vkorg} onChange={v => set('vkorg', v)} liveItems={liveF4?.PURCHASE_ORG} placeholder="Select Purchase Org" required invalid={missingFields.includes('vkorg')} />
              <SapF4SelectField label="Currency" masterType="currency" value={form.waers} onChange={v => set('waers', v)} liveItems={liveF4?.CURRENCY} placeholder="Select Currency" required invalid={missingFields.includes('waers')} />
              <TextField label="Group for Calc Schema (Supplier)" value={form.kalsk} onChange={v => set('kalsk', v)} />
              <ReadOnlyField label="MSME (Minority Indicator)" value={({ MIC: 'MIC — Micro', SMA: 'SMA — Small', MED: 'MED — Medium', ZNA: 'ZNA — Not Applicable' } as Record<string, string>)[form.msme] || form.msme} />
              <CheckboxField label="Check Duplicate Invoice" checked={form.cdi === 'X'}
                onChange={v => set('cdi', v ? 'X' : '')} />
              <CheckboxField label="GR-Based Invoice Verification" checked={form.webre === 'X'}
                onChange={v => set('webre', v ? 'X' : '')} />
              <CheckboxField label="Service-Based Invoice Verification" checked={form.lebre === 'X'}
                onChange={v => set('lebre', v ? 'X' : '')} />
            </Section>

            <Separator />

            {/* Withholding Tax — captured on SAP sync, filtered by vendor country */}
            <WithholdingTaxSection
              country={vendorCountry}
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



            {/* Classification — editable here (no longer captured during registration) */}
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2 text-primary">
                <Tags className="h-4 w-4" />Classification
              </h4>
              <RadioGroup
                value={classifyMode}
                onValueChange={(v) => handleClassifyModeChange(v as 'details' | 'cfstmt')}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="classify-details" value="details" />
                  <Label htmlFor="classify-details" className="text-sm cursor-pointer">Vendor_Details</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="classify-cfstmt" value="cfstmt" />
                  <Label htmlFor="classify-cfstmt" className="text-sm cursor-pointer">Vendor_CFSTMT</Label>
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
              if (missing.length === 0) {
                const cat = String(form.reg_msme_cat || '').toLowerCase().trim();
                const msmeCode = !form.reg_is_msme
                  ? 'ZNA'
                  : cat === 'small' ? 'SMA'
                  : cat === 'medium' ? 'MED'
                  : 'MIC';
                const finalClassify = classifyMode === 'details'
                  ? { ...form.classify, CASH: [], TIER: [] }
                  : { ...form.classify, MGV: [], CATV: [], LOCV: [], IDS: [] };
                onConfirm({
                  ...form,
                  classify: finalClassify,
                  msme: msmeCode,
                  idtype: form.reg_is_msme ? 'ZMSMEN' : '',
                  idnum: form.reg_is_msme ? (form.reg_msme_no || '') : '',
                });

              }
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
  const v: any = vendor || {};
  const cat = String(v.msme_category || '').toLowerCase().trim();
  const msmeCode = !msme
    ? 'ZNA'
    : cat === 'small' ? 'SMA'
    : cat === 'medium' ? 'MED'
    : 'MIC';
  return {
    partn_cat: d.partn_cat ?? '2',
    partn_grp: d.partn_grp ?? '',
    title: d.title ?? '0003',
    taxtype: d.taxtype ?? 'IN3',
    msme: msmeCode,
    idtype: msme ? 'ZMSMEN' : '',
    idnum: v.msme_number || '',
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
    ven_class: (d.ven_class !== undefined && d.ven_class !== null && d.ven_class !== '') ? d.ven_class : getSapVenClass(v),
    reg_addr1: v.registered_address ?? '',
    reg_addr2: v.registered_address_line2 ?? '',
    reg_addr3: v.registered_address_line3 ?? '',
    reg_addr4: v.registered_address_line4 ?? '',
    reg_city: v.registered_city ?? '',
    reg_state: v.registered_state ?? '',
    reg_pincode: v.registered_pincode ?? '',
    reg_contact1: v.registered_contact_1 ?? v.primary_phone ?? '',
    reg_contact2: v.registered_contact_2 ?? '',
    reg_email1: v.registered_email ?? v.primary_email ?? '',
    reg_email2: v.registered_email_2 ?? '',
    reg_is_msme: !!msme,
    reg_msme_no: v.msme_number ?? '',
    reg_msme_cat: v.msme_category ?? '',
    reg_msme_act: v.msme_major_activity ?? '',
    classify: {
      MGV: Array.isArray(v.material_group_vendors) ? v.material_group_vendors : [],
      CATV: Array.isArray(v.vendor_categories) ? v.vendor_categories : [],
      LOCV: Array.isArray(v.vendor_locations) ? v.vendor_locations : [],
      IDS: Array.isArray(v.identification_sources) ? v.identification_sources : [],
      CASH: Array.isArray(v.vendor_cashflow) ? v.vendor_cashflow : [],
      TIER: Array.isArray(v.tier_category) ? v.tier_category : [],
    },
    withholding: [],
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
  vendor_cashflow:       { code: 'ATWRT', desc: 'ATWTB' },
  tier_category:         { code: 'ATWRT', desc: 'ATWTB' },
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
  const isLive = Array.isArray(liveItems) && liveItems.length > 0;
  const { data: cachedRows, isLoading: isLoadingCache } = useSapMasterData(masterType);

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
  const isLive = Array.isArray(liveItems) && liveItems.length > 0;
  const { data: cachedRows, isLoading } = useSapMasterData(masterType);

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

type WTaxOption = { LAND1: string; TAXTYPE: string; TEXT40: string };

type WTaxCodeOption = { LAND1: string; WITHT: string; WT_WITHCD: string; TCDESC: string };
type RecTypeOption = { LAND1: string; WITHT: string; QSREC: string; RCTXT: string };

export function WithholdingTaxSection({
  country, rows, onChange, options, allOptions, loading, error, onRetry,
  taxcodesAll, rectypesAll, codeLoading, codeError, onCodeRetry,
}: {
  country: string;
  rows: WTaxRow[];
  onChange: (rows: WTaxRow[]) => void;
  options: WTaxOption[];
  allOptions: WTaxOption[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  taxcodesAll: WTaxCodeOption[];
  rectypesAll: RecTypeOption[];
  codeLoading: boolean;
  codeError: string | null;
  onCodeRetry: () => void;
}) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [openCodeIdx, setOpenCodeIdx] = useState<number | null>(null);
  const [openRecIdx, setOpenRecIdx] = useState<number | null>(null);

  const addRow = () => {
    onChange([
      ...rows,
      { witht: '', text40: '', wt_withcd: '', wt_subjct: true, qsrec: '', qland: country },
    ]);
  };

  const updateRow = (idx: number, patch: Partial<WTaxRow>) => {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const removeRow = (idx: number) => {
    onChange(rows.filter((_, i) => i !== idx));
  };

  const activeCodeRow = openCodeIdx !== null ? rows[openCodeIdx] : null;
  const activeRecRow = openRecIdx !== null ? rows[openRecIdx] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold flex items-center gap-2 text-primary">
          <Receipt className="h-4 w-4" />Withholding Tax
          {country && (
            <span className="text-xs font-normal text-muted-foreground">
              (Country: <span className="font-medium">{country}</span>)
            </span>
          )}
        </h4>
        <Button type="button" size="sm" variant="outline" onClick={addRow} className="h-8 rounded-lg">
          <Plus className="h-3.5 w-3.5 mr-1" />Add row
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />Loading withholding tax types…
        </div>
      )}
      {!loading && error && (
        <div className="flex items-start justify-between gap-2 text-xs text-destructive rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
            <span>{error}</span>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onRetry} className="h-6 px-2 text-destructive">
            Retry
          </Button>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-left">
              <th className="px-3 py-2 font-medium w-[140px]">WTax Type</th>
              <th className="px-3 py-2 font-medium">WTax Type Description</th>
              <th className="px-3 py-2 font-medium w-[160px]">WTax Code</th>
              <th className="px-3 py-2 font-medium w-[70px] text-center">Subject</th>
              <th className="px-3 py-2 font-medium w-[160px]">Rec.Type</th>
              <th className="px-3 py-2 w-[40px]"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No withholding tax rows. Click "Add row" to search and add.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={idx} className="border-t border-border align-top">
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <Input
                        value={r.witht}
                        onChange={(e) => updateRow(idx, { witht: e.target.value.toUpperCase() })}
                        className="h-8 rounded-md text-xs"
                        placeholder="WTax"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={() => setOpenIdx(idx)}
                        title="Search Withholding Tax Type"
                      >
                        <Search className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      value={r.text40}
                      onChange={(e) => updateRow(idx, { text40: e.target.value })}
                      className="h-8 rounded-md text-xs"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <Input
                        value={r.wt_withcd}
                        onChange={(e) => updateRow(idx, { wt_withcd: e.target.value.toUpperCase() })}
                        className="h-8 rounded-md text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={() => setOpenCodeIdx(idx)}
                        disabled={!r.witht}
                        title={r.witht ? 'Search WTax Code' : 'Select WTax Type first'}
                      >
                        <Search className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {r.wt_withcd_desc && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate" title={r.wt_withcd_desc}>
                        {r.wt_withcd_desc}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Checkbox
                      checked={r.wt_subjct}
                      onCheckedChange={(v) => updateRow(idx, { wt_subjct: !!v })}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1">
                      <Input
                        value={r.qsrec}
                        onChange={(e) => updateRow(idx, { qsrec: e.target.value.toUpperCase() })}
                        className="h-8 rounded-md text-xs"
                        placeholder="Rec.Type"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={() => setOpenRecIdx(idx)}
                        disabled={!r.witht}
                        title={r.witht ? 'Search Rec.Type' : 'Select WTax Type first'}
                      >
                        <Search className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {r.qsrec_desc && (
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate" title={r.qsrec_desc}>
                        {r.qsrec_desc}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => removeRow(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Rows are pushed to SAP as <code>WHOLDTAX</code> entries with LIFNR bound at sync time. QLAND is set to the vendor country ({country || '—'}).
      </p>

      <WithholdingTaxSearchDialog
        open={openIdx !== null}
        onOpenChange={(v) => { if (!v) setOpenIdx(null); }}
        country={country}
        options={options}
        allOptions={allOptions}
        loading={loading}
        error={error}
        onRetry={onRetry}
        onSelect={(opt) => {
          if (openIdx === null) return;
          updateRow(openIdx, {
            witht: opt.TAXTYPE,
            text40: opt.TEXT40,
            wt_withcd: '',
            wt_withcd_desc: '',
            qsrec: '',
            qsrec_desc: '',
            qland: opt.LAND1 || country,
          });
          setOpenIdx(null);
        }}
      />

      <WithholdingTaxCodeSearchDialog
        open={openCodeIdx !== null}
        onOpenChange={(v) => { if (!v) setOpenCodeIdx(null); }}
        country={country}
        witht={activeCodeRow?.witht || ''}
        all={taxcodesAll}
        loading={codeLoading}
        error={codeError}
        onRetry={onCodeRetry}
        onSelect={(opt) => {
          if (openCodeIdx === null) return;
          updateRow(openCodeIdx, {
            wt_withcd: opt.WT_WITHCD,
            wt_withcd_desc: opt.TCDESC,
          });
          setOpenCodeIdx(null);
        }}
      />

      <RecTypeSearchDialog
        open={openRecIdx !== null}
        onOpenChange={(v) => { if (!v) setOpenRecIdx(null); }}
        country={country}
        witht={activeRecRow?.witht || ''}
        all={rectypesAll}
        loading={codeLoading}
        error={codeError}
        onRetry={onCodeRetry}
        onSelect={(opt) => {
          if (openRecIdx === null) return;
          updateRow(openRecIdx, {
            qsrec: opt.QSREC,
            qsrec_desc: opt.RCTXT,
          });
          setOpenRecIdx(null);
        }}
      />
    </div>
  );
}

function WithholdingTaxSearchDialog({
  open, onOpenChange, country, options, allOptions, loading, error, onRetry, onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  country: string;
  options: WTaxOption[];
  allOptions: WTaxOption[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (opt: WTaxOption) => void;
}) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  const filteredEmpty = options.length === 0 && allOptions.length > 0;
  const baseList = filteredEmpty ? allOptions : options;

  const q = query.trim().toLowerCase();
  const list = q
    ? baseList.filter((o) =>
        `${o.TAXTYPE} ${o.TEXT40} ${o.LAND1}`.toLowerCase().includes(q),
      )
    : baseList;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Withholding Tax Type Search
          </DialogTitle>
          <DialogDescription>
            Select a withholding tax type{country ? ` for country ${country}` : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-muted-foreground">
            {loading
              ? 'Loading…'
              : `${list.length} ${list.length === 1 ? 'entry' : 'entries'} found${filteredEmpty ? ' — showing all countries' : country ? ` for ${country}` : ''}`}
          </div>
          {(error || !loading) && (
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onRetry} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
            </Button>
          )}
        </div>

        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search WTax Type / description / country…"
          className="h-9"
        />

        <div className="flex-1 min-h-0 overflow-y-auto border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading withholding tax types…
            </div>
          ) : error && baseList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-destructive px-4 text-center">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry</Button>
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No withholding tax types found.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium w-[110px]">WTax Type</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium w-[90px]">Country</th>
                </tr>
              </thead>
              <tbody>
                {list.map((opt) => (
                  <tr
                    key={`${opt.TAXTYPE}-${opt.LAND1}`}
                    className="border-t border-border cursor-pointer hover:bg-accent/50"
                    onClick={() => onSelect(opt)}
                  >
                    <td className="px-3 py-2 font-semibold">{opt.TAXTYPE}</td>
                    <td className="px-3 py-2">{opt.TEXT40}</td>
                    <td className="px-3 py-2 text-muted-foreground">{opt.LAND1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {filteredEmpty && (
          <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
            No entries for country {country || '—'}. Showing all countries.
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WithholdingTaxCodeSearchDialog({
  open, onOpenChange, country, witht, all, loading, error, onRetry, onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  country: string;
  witht: string;
  all: WTaxCodeOption[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (opt: WTaxCodeOption) => void;
}) {
  const [query, setQuery] = useState('');
  useEffect(() => { if (open) setQuery(''); }, [open]);

  const filtered = all.filter(
    (r) =>
      String(r.LAND1 || '').toUpperCase() === country.toUpperCase() &&
      String(r.WITHT || '').toUpperCase() === witht.toUpperCase(),
  );
  const q = query.trim().toLowerCase();
  const list = q
    ? filtered.filter((o) => `${o.WT_WITHCD} ${o.TCDESC} ${o.WITHT}`.toLowerCase().includes(q))
    : filtered;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Withholding Tax Code Search
          </DialogTitle>
          <DialogDescription>
            Select a WTax Code for country {country || '—'} and WTax Type {witht || '—'}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-muted-foreground">
            {loading ? 'Loading…' : `${list.length} ${list.length === 1 ? 'entry' : 'entries'} found`}
          </div>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onRetry} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
          </Button>
        </div>

        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search WTax Code / description…"
          className="h-9"
        />

        <div className="flex-1 min-h-0 overflow-y-auto border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : error && all.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-destructive px-4 text-center">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry</Button>
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No WTax Codes found for country {country || '—'} and WTax Type {witht || '—'}.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium w-[120px]">WTax Code</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium w-[100px]">WTax Type</th>
                </tr>
              </thead>
              <tbody>
                {list.map((opt, i) => (
                  <tr
                    key={`${opt.WT_WITHCD}-${opt.WITHT}-${opt.LAND1}-${i}`}
                    className="border-t border-border cursor-pointer hover:bg-accent/50"
                    onClick={() => onSelect(opt)}
                  >
                    <td className="px-3 py-2 font-semibold">{opt.WT_WITHCD}</td>
                    <td className="px-3 py-2">{opt.TCDESC}</td>
                    <td className="px-3 py-2 text-muted-foreground">{opt.WITHT}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecTypeSearchDialog({
  open, onOpenChange, country, witht, all, loading, error, onRetry, onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  country: string;
  witht: string;
  all: RecTypeOption[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onSelect: (opt: RecTypeOption) => void;
}) {
  const [query, setQuery] = useState('');
  useEffect(() => { if (open) setQuery(''); }, [open]);

  const filtered = all.filter(
    (r) =>
      String(r.LAND1 || '').toUpperCase() === country.toUpperCase() &&
      String(r.WITHT || '').toUpperCase() === witht.toUpperCase(),
  );
  const q = query.trim().toLowerCase();
  const list = q
    ? filtered.filter((o) => `${o.QSREC} ${o.RCTXT} ${o.WITHT}`.toLowerCase().includes(q))
    : filtered;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            Recipient Type Search
          </DialogTitle>
          <DialogDescription>
            Select a Rec.Type for country {country || '—'} and WTax Type {witht || '—'}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="text-xs text-muted-foreground">
            {loading ? 'Loading…' : `${list.length} ${list.length === 1 ? 'entry' : 'entries'} found`}
          </div>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={onRetry} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Refresh'}
          </Button>
        </div>

        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Rec.Type / description…"
          className="h-9"
        />

        <div className="flex-1 min-h-0 overflow-y-auto border rounded-md">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : error && all.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-destructive px-4 text-center">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>Retry</Button>
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No Rec.Types found for country {country || '—'} and WTax Type {witht || '—'}.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium w-[100px]">Rec.Type</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium w-[100px]">WTax Type</th>
                </tr>
              </thead>
              <tbody>
                {list.map((opt, i) => (
                  <tr
                    key={`${opt.QSREC}-${opt.WITHT}-${opt.LAND1}-${i}`}
                    className="border-t border-border cursor-pointer hover:bg-accent/50"
                    onClick={() => onSelect(opt)}
                  >
                    <td className="px-3 py-2 font-semibold">{opt.QSREC}</td>
                    <td className="px-3 py-2">{opt.RCTXT}</td>
                    <td className="px-3 py-2 text-muted-foreground">{opt.WITHT}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



