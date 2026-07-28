import { formatDateTime } from '@/lib/dateFormat';
import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { VendorReviewDialog } from '@/components/vendor/VendorReviewDialog';
import { VendorSubmissionPreviewDialog } from '@/components/vendor/VendorSubmissionPreviewDialog';
import {
  useVendors, useSAPSync, useMultipleSAPSync, useDMSSync, useBuyerCompanies, VendorRow,
} from '@/hooks/useVendors';
import {
  Search, Eye, CheckCircle, Building2, Loader2, RefreshCw, Upload, Server, FileText, FolderUp, XCircle, Ban, Undo2, MessageSquare, AlertTriangle,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SapFieldsDialog, SapFieldOverrides } from '@/components/sap/SapFieldsDialog';
import { MultipleSapSyncDialog } from '@/components/sap/MultipleSapSyncDialog';
import { ApprovalCommentsDialog } from '@/components/sap/ApprovalCommentsDialog';
import { TenantCombobox } from '@/components/admin/TenantCombobox';
import { getSapVenClass } from '@/lib/sapPayloadBuilder';
import { formatVendorName } from '@/lib/textCase';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

async function persistClassification(vendorIds: string[], overrides: SapFieldOverrides) {
  const c = overrides?.classify || ({} as any);
  const payload = {
    material_group_vendors: c.MGV || [],
    vendor_categories: c.CATV || [],
    vendor_locations: c.LOCV || [],
    identification_sources: c.IDS || [],
    vendor_cashflow: c.CASH || [],
    tier_category: c.TIER || [],
  };
  try {
    await supabase.from('vendors').update(payload as any).in('id', vendorIds);
  } catch (e) {
    console.warn('persistClassification failed', e);
  }
}

// ---- Themed result tables shared across the SAP Sync result dialogs ----
function parseDupMsgText(msgText: string) {
  const parts = String(msgText || '')
    .split(/\s+-\s+|\s+–\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    sapCode: parts[0] || '',
    name: parts[1] || '',
    pan: parts[2] || '',
    gstin: parts[3] || '',
    parts,
  };
}

function DuplicateVendorTable({ msgText }: { msgText: string }) {
  const { sapCode, name, pan, gstin, parts } = parseDupMsgText(msgText);
  const rowCls = 'border-b border-amber-100 odd:bg-amber-50/60 even:bg-white';
  return (
    <div className="rounded-xl border border-amber-300 bg-gradient-to-b from-amber-50 to-white overflow-hidden shadow-sm ring-1 ring-amber-200/60">
      <div className="px-4 py-2.5 bg-gradient-to-r from-amber-100 to-red-100 border-b border-amber-300 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-700" />
        <div>
          <p className="text-sm font-bold text-amber-900 leading-tight">Existing Vendor Details</p>
          <p className="text-[11px] text-amber-800/80">Vendor already exists in SAP</p>
        </div>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {parts.length >= 2 ? (
            <>
              {sapCode && (<tr className={rowCls}><td className="px-4 py-2 font-semibold text-amber-900 w-1/3">SAP Vendor Code</td><td className="px-4 py-2 font-mono text-amber-950">{sapCode}</td></tr>)}
              {name && (<tr className={rowCls}><td className="px-4 py-2 font-semibold text-amber-900">Vendor Name</td><td className="px-4 py-2 text-amber-950">{name}</td></tr>)}
              {pan && (<tr className={rowCls}><td className="px-4 py-2 font-semibold text-amber-900">PAN Number</td><td className="px-4 py-2 font-mono text-amber-950">{pan}</td></tr>)}
              {gstin && (<tr className="odd:bg-amber-50/60 even:bg-white"><td className="px-4 py-2 font-semibold text-amber-900">GSTIN</td><td className="px-4 py-2 font-mono text-amber-950">{gstin}</td></tr>)}
            </>
          ) : (
            <tr><td className="px-4 py-2 font-semibold text-amber-900 w-1/3 bg-amber-50/60">Details</td><td className="px-4 py-2 text-amber-950 whitespace-pre-wrap">{msgText}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SuccessVendorTable({ sapCode, bpName, message, refNo }: { sapCode?: string; bpName?: string; message?: string; refNo?: string }) {
  const rowCls = 'border-b border-emerald-100 odd:bg-emerald-50/60 even:bg-white';
  return (
    <div className="rounded-xl border border-emerald-300 bg-gradient-to-b from-emerald-50 to-white overflow-hidden shadow-sm ring-1 ring-emerald-200/60">
      <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-100 to-green-100 border-b border-emerald-300 flex items-center gap-2">
        <CheckCircle className="h-4 w-4 text-emerald-700" />
        <div>
          <p className="text-sm font-bold text-emerald-900 leading-tight">Vendor Details</p>
          <p className="text-[11px] text-emerald-800/80">Successfully created in SAP</p>
        </div>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {sapCode && (<tr className={rowCls}><td className="px-4 py-2 font-semibold text-emerald-900 w-1/3">SAP Vendor Code</td><td className="px-4 py-2 font-mono text-emerald-950">{sapCode}</td></tr>)}
          {bpName && (<tr className={rowCls}><td className="px-4 py-2 font-semibold text-emerald-900">Business Partner</td><td className="px-4 py-2 text-emerald-950">{bpName}</td></tr>)}
          {refNo && (<tr className={rowCls}><td className="px-4 py-2 font-semibold text-emerald-900">Reference No</td><td className="px-4 py-2 font-mono text-emerald-950">{refNo}</td></tr>)}
          {message && (<tr className="odd:bg-emerald-50/60 even:bg-white"><td className="px-4 py-2 font-semibold text-emerald-900">Message</td><td className="px-4 py-2 text-emerald-950">{message}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}



export default function SAPSync() {
  const [searchTerm, setSearchTerm] = useState('');
  const [buyerCompanyFilter, setBuyerCompanyFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'sap' | 'dms' | 'rejected'>('sap');
  const [rejectVendor, setRejectVendor] = useState<VendorRow | null>(null);
  const [commentsVendor, setCommentsVendor] = useState<VendorRow | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [rejectingVendorId, setRejectingVendorId] = useState<string | null>(null);
  const [returnVendor, setReturnVendor] = useState<VendorRow | null>(null);
  const [returnRemarks, setReturnRemarks] = useState('');
  const [returningVendorId, setReturningVendorId] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorRow | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [previewVendorId, setPreviewVendorId] = useState<string | null>(null);
  const [showSapFieldsDialog, setShowSapFieldsDialog] = useState(false);
  const [pendingSyncVendor, setPendingSyncVendor] = useState<VendorRow | null>(null);
  const [sapSyncResult, setSapSyncResult] = useState<any>(null);
  const [showSapResultDialog, setShowSapResultDialog] = useState(false);
  const [syncingVendorId, setSyncingVendorId] = useState<string | null>(null);

  // Multi-select state
  const [selectedSapIds, setSelectedSapIds] = useState<Set<string>>(new Set());
  const [selectedDmsIds, setSelectedDmsIds] = useState<Set<string>>(new Set());
  const [showMultipleSync, setShowMultipleSync] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [showBulkResult, setShowBulkResult] = useState(false);
  const [dmsResult, setDmsResult] = useState<any>(null);
  const [showDmsResult, setShowDmsResult] = useState(false);

  const { data: sapVendors, isLoading, refetch } = useVendors(['pending_sap_sync', 'purchase_approved']);
  const { data: dmsVendors, isLoading: dmsLoading, refetch: refetchDms } = useVendors(['dms_sync_pending', 'dms_synced']);
  const { data: rejectedVendors, isLoading: rejectedLoading, refetch: refetchRejected } = useVendors(['sap_team_closed' as any, 'sap_team_rejected' as any]);
  const { data: buyerCompanies } = useBuyerCompanies();
  const sapSync = useSAPSync();
  const bulkSync = useMultipleSAPSync();
  const dmsSync = useDMSSync();

  const filterFn = (vendor: VendorRow) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (vendor.trade_name || '').toLowerCase().includes(q) ||
      (vendor.legal_name || '').toLowerCase().includes(q) ||
      ((vendor as any).account_holder_name || '').toLowerCase().includes(q) ||
      (vendor.gstin || '').toLowerCase().includes(q) ||
      vendor.id.toLowerCase().includes(q);
    const matchesBuyer = buyerCompanyFilter === 'all' || vendor.tenant_id === buyerCompanyFilter;
    return matchesSearch && matchesBuyer;
  };


  const filteredSap = (sapVendors || []).filter(filterFn);
  const filteredDms = (dmsVendors || []).filter(filterFn);
  const filteredRejected = (rejectedVendors || []).filter(filterFn);

  const refreshAllLists = () => { refetch(); refetchDms(); refetchRejected(); };

  const handleConfirmReject = async () => {
    if (!rejectVendor) return;
    const remarks = rejectRemarks.trim();
    if (!remarks) {
      toast.error('Reject Remarks are required');
      return;
    }
    setRejectingVendorId(rejectVendor.id);
    try {
      const { data, error } = await supabase.functions.invoke('sap-team-reject-vendor', {
        body: { vendorId: rejectVendor.id, remarks },
      });
      if (error) throw error;
      if (data && (data as any).error) throw new Error((data as any).error);
      const label = formatVendorName(rejectVendor) || rejectVendor.id;
      const emailSent = !!(data as any)?.email_sent;
      if (emailSent) {
        toast.success('Vendor closed — buyer notified by email', { description: label });
      } else {
        const err = (data as any)?.email_error;
        toast.warning('Vendor closed (buyer email failed)', { description: `${label}${err ? ` — ${err}` : ''}` });
      }
      setRejectVendor(null);
      setRejectRemarks('');
      refreshAllLists();
    } catch (e: any) {
      toast.error('Close failed', { description: e?.message || 'Could not close vendor' });
    } finally {
      setRejectingVendorId(null);
    }
  };

  const handleConfirmReturnToBuyer = async () => {
    if (!returnVendor) return;
    const remarks = returnRemarks.trim();
    if (!remarks) {
      toast.error('Remarks are required');
      return;
    }
    setReturningVendorId(returnVendor.id);
    const vendorLabel = formatVendorName(returnVendor) || returnVendor.id;
    try {
      const invokeReturn = (forceReject: boolean) =>
        supabase.functions.invoke('sap-team-return-to-buyer', {
          body: { vendorId: returnVendor.id, remarks, forceReject },
        });

      let { data, error } = await invokeReturn(false);
      if (error) throw error;

      // Email failed — ask the SAP user to confirm before proceeding.
      if (data && (data as any).ok === false && (data as any).requires_confirmation) {
        const msg = (data as any).error || 'Unable to send rejection email to the buyer.';
        const proceed = window.confirm(
          `${msg}\n\nProceed with the rejection anyway? The buyer will NOT receive an email notification.`,
        );
        if (!proceed) {
          return;
        }
        ({ data, error } = await invokeReturn(true));
        if (error) throw error;
      }

      if (data && (data as any).error && (data as any).ok !== true) {
        throw new Error((data as any).error);
      }

      const emailSent = !!(data as any)?.email_sent;
      if (emailSent) {
        toast.success('Sent back to Buyer — buyer notified by email', { description: vendorLabel });
      } else {
        const err = (data as any)?.email_error || 'email not delivered';
        toast.warning('Sent back to Buyer (email failed)', { description: `${vendorLabel} — ${err}` });
      }
      setReturnVendor(null);
      setReturnRemarks('');
      refreshAllLists();
    } catch (e: any) {
      toast.error('Return to Buyer failed', { description: e?.message || 'Could not return vendor' });
    } finally {
      setReturningVendorId(null);
    }
  };


  const selectedSapVendors = useMemo(
    () => filteredSap.filter(v => selectedSapIds.has(v.id)),
    [filteredSap, selectedSapIds],
  );
  const selectedDmsVendors = useMemo(
    () => filteredDms.filter(v => selectedDmsIds.has(v.id) && v.status !== 'dms_synced'),
    [filteredDms, selectedDmsIds],
  );
  const multiMode = selectedSapVendors.length > 1;

  const getBuyerCompanyName = (tenantId: string | null) => {
    if (!tenantId || !buyerCompanies) return 'Unassigned';
    const c = buyerCompanies.find(c => c.id === tenantId);
    return c ? `${c.name} (${c.code})` : 'Unassigned';
  };

  const isVendorMsme = (v: VendorRow | null) => {
    const x = v as any;
    return !!(x?.msme_number) || x?.msme_verification_status === 'passed';
  };
  const getApprovalLabel = (v: VendorRow) => isVendorMsme(v) ? 'CEO Office Approved' : 'Finance 2 Approved';

  const toggleSap = (id: string) => {
    setSelectedSapIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAllSap = () => {
    if (selectedSapIds.size === filteredSap.length) setSelectedSapIds(new Set());
    else setSelectedSapIds(new Set(filteredSap.map(v => v.id)));
  };

  const toggleDms = (id: string) => {
    setSelectedDmsIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const openSapFieldsDialog = (vendor: VendorRow) => {
    setPendingSyncVendor(vendor);
    setShowSapFieldsDialog(true);
  };

  const getSapRowMessage = (r: any) => String(r?.LONGMSG || r?.LONG_MSG || r?.MSG_TEXT || r?.MSGTEXT || r?.MSG_LONG_TEXT || r?.MSG || r?.message || '').trim();
  const getSapRowRef = (r: any) => String(r?.REFER_NUM || r?.refer_num || r?.idnum || r?.IDNUM || r?.refNo || '').trim().toUpperCase();

  const isPanDuplicateResponse = (resp: any): { matched: boolean; message: string; msgText: string } => {
    if (!resp) return { matched: false, message: '', msgText: '' };
    const re = /pan\s*number\s*duplicat|duplicate\s*pan|pan\s*&\s*gst\s*combination\s*is\s*duplicat/i;
    const readMsgText = (o: any) =>
      String(o?.MSG_TEXT || o?.MSGTEXT || o?.MSG_LONG_TEXT || '').trim();
    const readLongMsg = (o: any) =>
      String(o?.LONGMSG || o?.LONG_MSG || o?.MSG || o?.message || '').trim();

    // Collect ACC_RES + TOT_RES rows across all shapes we produce:
    //  - { ACC_RES, TOT_RES }                              (single)
    //  - { sapResponse: {...} } or { sapResponse: [...] }  (edge fn wrap)
    //  - [{ ACC_RES, TOT_RES }, ...]                       (raw SAP array)
    //  - per-vendor bulk: { raw:{...}, totRaw:{...} }
    const rows: any[] = [];
    const collect = (node: any) => {
      if (!node) return;
      if (Array.isArray(node)) { for (const n of node) collect(n); return; }
      if (typeof node !== 'object') return;
      if (Array.isArray(node.ACC_RES)) rows.push(...node.ACC_RES);
      if (Array.isArray(node.TOT_RES)) rows.push(...node.TOT_RES);
      if (node.sapResponse) collect(node.sapResponse);
      if (node.raw) collect(node.raw);
      if (node.totRaw) collect(node.totRaw);
    };
    collect(resp);
    // Fallback: response itself may be a bare row (bulk per-vendor shape)
    if (rows.length === 0 && (readLongMsg(resp) || readMsgText(resp))) rows.push(resp);

    // Prefer the row whose LONGMSG matches the duplicate regex — its MSG_TEXT
    // carries the existing vendor line ("SAPCODE - NAME - PAN [- GSTIN]").
    let matchedRow: any = null;
    for (const r of rows) {
      if (re.test(readLongMsg(r))) { matchedRow = r; break; }
    }
    const topMsg = String(resp?.message || '').trim();
    const matched = !!matchedRow || (topMsg ? re.test(topMsg) : false);
    if (!matched) return { matched: false, message: '', msgText: '' };

    const message = readLongMsg(matchedRow) || topMsg;
    let msgText = readMsgText(matchedRow);
    if (!msgText) {
      for (const r of rows) {
        const t = readMsgText(r);
        if (t) { msgText = t; break; }
      }
    }
    // Normalize whitespace inside the existing-vendor line
    msgText = msgText.replace(/\s+-\s+/g, ' - ').replace(/\s{2,}/g, ' ').trim();
    return { matched: true, message, msgText };
  };



  const autoRejectAsDuplicate = async (vendorId: string, remarks: string, existingVendorText?: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('sap-team-reject-vendor', {
        body: { vendorId, remarks: remarks || 'Duplicate detected in SAP (PAN or PAN+GST combination already exists)', autoTriggered: true, existingVendorText: existingVendorText || '' },
      });
      if (error) throw error;
      if (data && (data as any).error) throw new Error((data as any).error);
      toast.success('Moved to Duplicate & Closed');
      refreshAllLists();
    } catch (e) {
      console.warn('[SAPSync] auto duplicate-close failed', e);
    }
  };

  const handleConfirmSync = async (overrides: SapFieldOverrides) => {
    const vendor = pendingSyncVendor;
    if (!vendor) return;
    console.log('[SAPSync] handleConfirmSync starting for vendor', vendor.id, overrides);
    toast.info('Syncing vendor to SAP…', { description: formatVendorName(vendor) || vendor.id });
    setSyncingVendorId(vendor.id);
    try {
      await persistClassification([vendor.id], overrides);
      const result = await sapSync.mutateAsync({ vendorId: vendor.id, overrides });
      console.log('[SAPSync] sapSync result', result);
      setSapSyncResult(result.sapResponse);
      setSelectedVendor(vendor);
      setShowSapFieldsDialog(false);
      setShowSapResultDialog(true);
      setSelectedSapIds(new Set());
      const dup = isPanDuplicateResponse(result.sapResponse);
      if (dup.matched) {
        await autoRejectAsDuplicate(vendor.id, dup.message, dup.msgText);
      } else {
        toast.success('SAP sync complete');
      }
    } catch (error: any) {
      console.error('[SAPSync] sapSync failed', error);
      const msg = error?.message || 'SAP sync failed';
      toast.error('SAP sync failed', { description: msg });
      // useSAPSync throws with err.sapResult (full envelope: {ACC_RES, sapResponse, ...})
      // and err.sapResponse (raw SAP array). Prefer those so isPanDuplicateResponse
      // can extract MSG_TEXT from the actual duplicate row instead of a synthesized
      // one-liner that only carries LONGMSG.
      let failResp: any;
      if (error?.sapResult && typeof error.sapResult === 'object') {
        failResp = error.sapResult;
      } else if (error?.sapResponse) {
        failResp = { success: false, message: msg, sapResponse: error.sapResponse };
      } else {
        const fallback = error?.ACC_RES ?? [
          { MSGTYP: 'E', LONGMSG: msg, BP_LIFNR: '', BPNAME: vendor.legal_name || '' },
        ];
        failResp = { success: false, message: msg, ACC_RES: fallback };
      }
      setSapSyncResult(failResp);
      setSelectedVendor(vendor);
      setShowSapFieldsDialog(false);
      setShowSapResultDialog(true);
      const dup = isPanDuplicateResponse(failResp);
      if (dup.matched) {
        await autoRejectAsDuplicate(vendor.id, dup.message, dup.msgText);
      }
    } finally {
      setSyncingVendorId(null);
    }
  };

  const handleMultipleSync = async (overrides: SapFieldOverrides) => {
    const vendorIds = selectedSapVendors.map(v => v.id);
    try {
      await persistClassification(vendorIds, overrides);
      const result = await bulkSync.mutateAsync({ vendorIds, overrides });
      setBulkResult(result);
      setShowMultipleSync(false);
      setShowBulkResult(true);
      setSelectedSapIds(new Set());
      // Auto-move PAN-duplicate failures
      const results: any[] = Array.isArray(result?.results) ? result.results : [];
      const dupIds: { id: string; msg: string; msgText: string }[] = [];
      for (const r of results) {
        const vid = r?.vendorId || r?.vendor_id;
        const dup = isPanDuplicateResponse(r?.sapResponse || r);
        if (vid && dup.matched) dupIds.push({ id: vid, msg: dup.message, msgText: dup.msgText });
      }
      if (dupIds.length === 0) {
        const dup = isPanDuplicateResponse(result);
        if (dup.matched) {
          for (const vid of vendorIds) dupIds.push({ id: vid, msg: dup.message, msgText: dup.msgText });
        }
      }
      for (const d of dupIds) {
        try {
          await supabase.functions.invoke('sap-team-reject-vendor', {
            body: { vendorId: d.id, remarks: d.msg || 'Duplicate detected in SAP (PAN or PAN+GST combination already exists)', autoTriggered: true, existingVendorText: d.msgText || '' },
          });
        } catch (e) {
          console.warn('[SAPSync] bulk auto duplicate-close failed', d.id, e);
        }
      }
      if (dupIds.length > 0) {
        toast.success(`Moved ${dupIds.length} vendor(s) to Duplicate & Closed`);
        refreshAllLists();
      }
    } catch (error: any) {
      setBulkResult({ success: false, message: error?.message || 'Bulk sync failed', ACC_RES: [], results: [] });
      setShowMultipleSync(false);
      setShowBulkResult(true);
    }
  };


  const handleDmsSync = async (vendorIds: string[]) => {
    try {
      const result = await dmsSync.mutateAsync({ vendorIds });
      setDmsResult(result);
      setShowDmsResult(true);
      setSelectedDmsIds(new Set());
    } catch (error: any) {
      setDmsResult({ success: false, message: error?.message || 'DMS sync failed', results: [] });
      setShowDmsResult(true);
    }
  };

  const refreshAll = () => { refetch(); refetchDms(); refetchRejected(); };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Server className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">SAP Sync</h1>
          </div>
          <p className="text-muted-foreground">Sync approved vendors to SAP and upload documents to DMS</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={refreshAll} variant="outline" size="icon" className="rounded-xl">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <div className="relative w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search vendors..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-11 h-11 rounded-xl" />
          </div>
          <TenantCombobox
            tenants={buyerCompanies ?? []}
            value={buyerCompanyFilter === 'all' ? null : buyerCompanyFilter}
            onChange={(id) => setBuyerCompanyFilter(id ?? 'all')}
            allowAll
            allLabel="All Buyer Companies"
            placeholder="Filter by buyer"
            className="w-56"
            triggerClassName="h-11 rounded-xl"
          />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending for SAP Sync</p>
                <p className="text-3xl font-bold text-blue-600">{filteredSap.length}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-500 flex items-center justify-center">
                <Upload className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">DMS Sync Pending</p>
                <p className="text-3xl font-bold text-emerald-600">
                  {filteredDms.filter(v => v.status === 'dms_sync_pending').length}
                </p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-500 flex items-center justify-center">
                <FolderUp className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3 bg-slate-100 border border-slate-200">
          <TabsTrigger value="sap" className="gap-2 data-[state=active]:!bg-blue-600 data-[state=active]:!text-white data-[state=active]:!shadow-md"><Server className="h-4 w-4" />SAP Sync</TabsTrigger>
          <TabsTrigger value="dms" className="gap-2 data-[state=active]:!bg-blue-600 data-[state=active]:!text-white data-[state=active]:!shadow-md"><FolderUp className="h-4 w-4" />DMS Sync</TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2 data-[state=active]:!bg-blue-600 data-[state=active]:!text-white data-[state=active]:!shadow-md"><Ban className="h-4 w-4" />Duplicate &amp; Closed{filteredRejected.length > 0 && <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-100 text-red-700 text-xs px-2 py-0.5">{filteredRejected.length}</span>}</TabsTrigger>
        </TabsList>

        {/* SAP Sync tab */}
        <TabsContent value="sap" className="space-y-4 mt-6">
          {/* Toolbar: select all + multiple sync */}
          {filteredSap.length > 0 && (
            <div className="flex items-center justify-between bg-card border rounded-xl p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selectedSapIds.size > 0 && selectedSapIds.size === filteredSap.length}
                  onCheckedChange={toggleAllSap}
                  className="!bg-white !border-2 !border-black data-[state=checked]:!bg-white data-[state=checked]:!text-black"
                />
                <span className="text-sm text-muted-foreground">
                  {selectedSapIds.size > 0 ? `${selectedSapIds.size} selected` : 'Select vendors to enable bulk actions'}
                </span>
              </div>
              {multiMode && (
                <Button
                  className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-blue-500/20"
                  onClick={() => setShowMultipleSync(true)}
                  disabled={bulkSync.isPending}
                >
                  {bulkSync.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</>
                  ) : (
                    <><Server className="h-4 w-4 mr-2" />Multiple Sync ({selectedSapVendors.length})</>
                  )}
                </Button>
              )}
            </div>
          )}

          <div className="grid gap-4">
            {isLoading ? (
              [...Array(3)].map((_, i) => (
                <Card key={i} className="border-0 shadow-md"><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))
            ) : filteredSap.length === 0 ? (
              <Card className="border-0 shadow-md"><CardContent className="py-16 text-center">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold">No vendors pending SAP sync</h3>
                <p className="text-muted-foreground mt-2">All approved vendors have been synced.</p>
              </CardContent></Card>
            ) : (
              filteredSap.map((vendor) => (
                <Card key={vendor.id} className={`border-0 shadow-md card-interactive ${selectedSapIds.has(vendor.id) ? 'ring-2 ring-blue-500' : ''}`}>
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <Checkbox
                          checked={selectedSapIds.has(vendor.id)}
                          onCheckedChange={() => toggleSap(vendor.id)}
                          className="mt-2 !bg-white !border-2 !border-black data-[state=checked]:!bg-white data-[state=checked]:!text-black"
                        />
                        <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/5 flex items-center justify-center">
                          <Building2 className="h-7 w-7 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-bold text-lg">{formatVendorName(vendor) || "Unnamed Vendor"}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground">{getBuyerCompanyName(vendor.tenant_id)} • {vendor.industry_type}</p>
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="font-mono bg-muted px-2 py-0.5 rounded">Ref: {(vendor as any).reference_number || vendor.id.slice(0, 8).toUpperCase()}</span>
                            <span>GSTIN: {vendor.gstin || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" className="rounded-xl" onClick={() => { setSelectedVendor(vendor); setShowDetails(true); }}>
                          <Eye className="h-4 w-4 mr-2" />View Details
                        </Button>
                        <Button
                          className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 shadow-lg shadow-blue-500/20"
                          onClick={() => openSapFieldsDialog(vendor)}
                          disabled={syncingVendorId === vendor.id || multiMode}
                          title={multiMode ? 'Uncheck other vendors to sync individually' : ''}
                        >
                          {syncingVendorId === vendor.id ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Syncing...</>
                          ) : (
                            <><Server className="h-4 w-4 mr-2" />Prepare &amp; Sync</>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => { setRejectVendor(vendor); setRejectRemarks(''); }}
                          disabled={rejectingVendorId === vendor.id || multiMode}
                          title={multiMode ? 'Uncheck other vendors to close individually' : 'Mark as duplicate (already in SAP) and close'}
                        >
                          {rejectingVendorId === vendor.id ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Closing...</>
                          ) : (
                            <><XCircle className="h-4 w-4 mr-2" />Duplicate &amp; Close</>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                          onClick={() => { setReturnVendor(vendor); setReturnRemarks(''); }}
                          disabled={returningVendorId === vendor.id || multiMode}
                          title={multiMode ? 'Uncheck other vendors to return individually' : 'Send back to the inviting Buyer for correction'}
                        >
                          {returningVendorId === vendor.id ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending back...</>
                          ) : (
                            <><Undo2 className="h-4 w-4 mr-2" />Reject &amp; Send to Buyer</>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => setCommentsVendor(vendor)}
                          title="View approval comment history"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />Comments
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* DMS Sync tab */}
        <TabsContent value="dms" className="space-y-4 mt-6">
          {selectedDmsVendors.length > 0 && (
            <div className="flex items-center justify-between bg-card border rounded-xl p-3 shadow-sm">
              <span className="text-sm text-muted-foreground">{selectedDmsVendors.length} selected for DMS upload</span>
              <Button
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-lg"
                onClick={() => handleDmsSync(selectedDmsVendors.map(v => v.id))}
                disabled={dmsSync.isPending}
              >
                {dmsSync.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</>
                ) : (
                  <><FolderUp className="h-4 w-4 mr-2" />Bulk DMS Sync ({selectedDmsVendors.length})</>
                )}
              </Button>
            </div>
          )}

          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              {dmsLoading ? (
                <div className="p-6"><Skeleton className="h-32 w-full" /></div>
              ) : filteredDms.length === 0 ? (
                <div className="py-16 text-center">
                  <FolderUp className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold">No vendors pending DMS sync</h3>
                  <p className="text-muted-foreground mt-1 text-sm">Vendors synced to SAP will appear here.</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Ref Number</TableHead>
                        <TableHead>SAP Vendor Code</TableHead>
                        <TableHead>Sync Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDms.map((v) => {
                        const refNo = (v as any).sap_reference_no || v.id.slice(0, 8).toUpperCase();
                        const sapCode = (v as any).sap_vendor_code || '—';
                        const isSynced = v.status === 'dms_synced';
                        return (
                          <TableRow key={v.id}>
                            <TableCell>
                              {!isSynced && (
                                <Checkbox
                                  checked={selectedDmsIds.has(v.id)}
                                  onCheckedChange={() => toggleDms(v.id)}
                                  className="!bg-white !border-2 !border-black data-[state=checked]:!bg-white data-[state=checked]:!text-black"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{formatVendorName(v) || "Unnamed"}</div>
                              <div className="text-xs text-muted-foreground">{getBuyerCompanyName(v.tenant_id)}</div>
                            </TableCell>
                            <TableCell><span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{refNo}</span></TableCell>
                            <TableCell><span className="font-mono text-xs">{sapCode}</span></TableCell>
                            <TableCell>
                              <Badge className={isSynced ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}>
                                {isSynced ? 'DMS Synced' : 'Pending DMS'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" className="rounded-lg" onClick={() => { setSelectedVendor(v); setShowDetails(true); }}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {!isSynced && (
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                                    onClick={() => handleDmsSync([v.id])}
                                    disabled={dmsSync.isPending}
                                  >
                                    {dmsSync.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <><FolderUp className="h-4 w-4 mr-1" />Sync to DMS</>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rejected tab */}
        <TabsContent value="rejected" className="space-y-4 mt-6">
          <div className="grid gap-4">
            {rejectedLoading ? (
              [...Array(2)].map((_, i) => (
                <Card key={i} className="border-0 shadow-md"><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
              ))
            ) : filteredRejected.length === 0 ? (
              <Card className="border-0 shadow-md"><CardContent className="py-16 text-center">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Ban className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold">No duplicate &amp; closed vendors</h3>
                <p className="text-muted-foreground mt-2">Vendors closed as duplicates (already in SAP) will appear here.</p>
              </CardContent></Card>
            ) : (
              filteredRejected.map((vendor) => {
                const remarks = (vendor as any).last_rejection_comments as string | null;
                const rejectedAt = (vendor as any).last_rejected_at as string | null;
                const refNo = (vendor as any).reference_number || vendor.id.slice(0, 8).toUpperCase();
                const dupRaw = ((vendor as any).sap_duplicate_details || '').toString().trim();
                const dupParts = dupRaw
                  ? dupRaw.split(/\s+-\s+|\s+–\s+/).map((s: string) => s.trim()).filter(Boolean)
                  : [];
                const [dupSapCode, dupName, dupPan, dupGstin] = [
                  dupParts[0] || '', dupParts[1] || '', dupParts[2] || '', dupParts[3] || ''
                ];
                return (
                  <Card key={vendor.id} className="border-0 shadow-md border-l-4 border-l-red-500">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-red-500/20 to-rose-500/5 flex items-center justify-center">
                            <Building2 className="h-7 w-7 text-red-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1 flex-wrap">
                              <h3 className="font-bold text-lg">{formatVendorName(vendor) || "Unnamed Vendor"}</h3>
                              <Badge className="bg-red-100 text-red-700 border-red-200">Duplicate &amp; Closed</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{getBuyerCompanyName(vendor.tenant_id)} • {vendor.industry_type}</p>
                            {dupRaw && (
                              <div className="mt-3 rounded-xl border border-amber-300 bg-gradient-to-b from-amber-50 to-white overflow-hidden shadow-sm ring-1 ring-amber-200/60">
                                <div className="px-4 py-2.5 bg-gradient-to-r from-amber-100 to-red-100 border-b border-amber-300 flex items-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-amber-700" />
                                  <div>
                                    <p className="text-sm font-bold text-amber-900 leading-tight">Existing Vendor Details</p>
                                    <p className="text-[11px] text-amber-800/80">Vendor already exists in SAP</p>
                                  </div>
                                </div>
                                <table className="w-full text-sm">
                                  <tbody>
                                    {dupParts.length >= 2 ? (
                                      <>
                                        {dupSapCode && (
                                          <tr className="border-b border-amber-100 odd:bg-amber-50/60 even:bg-white">
                                            <td className="px-4 py-2 font-semibold text-amber-900 w-1/3">SAP Vendor Code</td>
                                            <td className="px-4 py-2 font-mono text-amber-950">{dupSapCode}</td>
                                          </tr>
                                        )}
                                        {dupName && (
                                          <tr className="border-b border-amber-100 odd:bg-amber-50/60 even:bg-white">
                                            <td className="px-4 py-2 font-semibold text-amber-900">Vendor Name</td>
                                            <td className="px-4 py-2 text-amber-950">{dupName}</td>
                                          </tr>
                                        )}
                                        {dupPan && (
                                          <tr className="border-b border-amber-100 odd:bg-amber-50/60 even:bg-white">
                                            <td className="px-4 py-2 font-semibold text-amber-900">PAN Number</td>
                                            <td className="px-4 py-2 font-mono text-amber-950">{dupPan}</td>
                                          </tr>
                                        )}
                                        {dupGstin && (
                                          <tr className="odd:bg-amber-50/60 even:bg-white">
                                            <td className="px-4 py-2 font-semibold text-amber-900">GSTIN</td>
                                            <td className="px-4 py-2 font-mono text-amber-950">{dupGstin}</td>
                                          </tr>
                                        )}
                                      </>
                                    ) : (
                                      <tr>
                                        <td className="px-4 py-2 font-semibold text-amber-900 w-1/3 bg-amber-50/60">Details</td>
                                        <td className="px-4 py-2 text-amber-950 whitespace-pre-wrap">{dupRaw}</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            )}
                            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                              <span className="font-mono bg-muted px-2 py-0.5 rounded">Ref No: {refNo}</span>
                              <span>GSTIN: {vendor.gstin || 'N/A'}</span>
                              {rejectedAt && <span>Closed: {formatDateTime(rejectedAt)}</span>}
                            </div>
                            {remarks && (
                              <div className="mt-3 rounded-lg bg-red-50 border border-red-200 p-3">
                                <p className="text-xs font-semibold text-red-700 mb-1">Duplicate &amp; Close Remarks</p>
                                <p className="text-sm text-red-900 whitespace-pre-wrap">{remarks}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" className="rounded-xl" onClick={() => { setSelectedVendor(vendor); setShowDetails(true); }}>
                            <Eye className="h-4 w-4 mr-2" />View Details
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Reject confirmation dialog */}
      <Dialog open={!!rejectVendor} onOpenChange={(o) => { if (!o) { setRejectVendor(null); setRejectRemarks(''); } }}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Duplicate &amp; Close Vendor
            </DialogTitle>
            <DialogDescription>
              The vendor will be marked as a <span className="font-semibold">duplicate (already available in SAP)</span> and moved to the Duplicate &amp; Closed tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-semibold">{formatVendorName(rejectVendor) || "Unnamed Vendor"}</p>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Ref No: {(rejectVendor as any)?.reference_number || rejectVendor?.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reject-remarks">
                Duplicate &amp; Close Remarks <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="reject-remarks"
                value={rejectRemarks}
                onChange={(e) => setRejectRemarks(e.target.value)}
                placeholder="e.g. Vendor already exists in SAP"
                rows={4}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Required. Shown to reviewers in the Duplicate &amp; Closed tab.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { setRejectVendor(null); setRejectRemarks(''); }}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirmReject}
              disabled={!rejectRemarks.trim() || !!rejectingVendorId}
            >
              {rejectingVendorId ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Closing...</>
              ) : (
                <><XCircle className="h-4 w-4 mr-2" />Confirm Duplicate &amp; Close</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return-to-Buyer dialog */}
      <Dialog open={!!returnVendor} onOpenChange={(o) => { if (!o) { setReturnVendor(null); setReturnRemarks(''); } }}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="h-5 w-5 text-amber-600" />
              Reject &amp; Send to Buyer
            </DialogTitle>
            <DialogDescription>
              The vendor will be returned to the inviting Buyer for correction. They will be notified by email and can resubmit, restarting the full approval workflow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-semibold">{formatVendorName(returnVendor) || "Unnamed Vendor"}</p>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Ref No: {(returnVendor as any)?.reference_number || returnVendor?.id.slice(0, 8).toUpperCase()}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="return-remarks">
                Remarks <span className="text-red-600">*</span>
              </Label>
              <Textarea
                id="return-remarks"
                value={returnRemarks}
                onChange={(e) => setReturnRemarks(e.target.value)}
                placeholder="e.g. PAN mismatch — please re-verify and resubmit"
                rows={4}
                className="rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Required. Shared with the Buyer in the notification email.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => { setReturnVendor(null); setReturnRemarks(''); }}>
              Cancel
            </Button>
            <Button
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleConfirmReturnToBuyer}
              disabled={!returnRemarks.trim() || !!returningVendorId}
            >
              {returningVendorId ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending back...</>
              ) : (
                <><Undo2 className="h-4 w-4 mr-2" />Send to Buyer</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <VendorReviewDialog
        vendorId={selectedVendor?.id ?? null}
        open={showDetails}
        onOpenChange={setShowDetails}
      />

      <VendorSubmissionPreviewDialog
        vendorId={previewVendorId}
        open={!!previewVendorId}
        onOpenChange={(o) => { if (!o) setPreviewVendorId(null); }}
      />

      <SapFieldsDialog
        open={showSapFieldsDialog}
        onOpenChange={(o) => { setShowSapFieldsDialog(o); if (!o) setPendingSyncVendor(null); }}
        vendor={pendingSyncVendor}
        onConfirm={handleConfirmSync}
        isSubmitting={!!syncingVendorId}
      />

      <MultipleSapSyncDialog
        open={showMultipleSync}
        onOpenChange={setShowMultipleSync}
        vendors={selectedSapVendors}
        onConfirm={handleMultipleSync}
        isSubmitting={bulkSync.isPending}
      />

      {/* Single SAP Sync Result Dialog */}
      <Dialog open={showSapResultDialog} onOpenChange={(open) => {
        setShowSapResultDialog(open);
        if (!open) { setShowDetails(false); setSelectedVendor(null); setSapSyncResult(null); }
      }}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {sapSyncResult?.success === false ? (
                <><Server className="h-6 w-6 text-red-600" />SAP Sync Failed</>
              ) : (
                <><CheckCircle className="h-6 w-6 text-green-600" />SAP Sync Successful</>
              )}
            </DialogTitle>
            <DialogDescription>
              {sapSyncResult?.success === false
                ? 'SAP rejected the request. Review the response below.'
                : 'Vendor synced to SAP and moved to DMS Sync.'}
            </DialogDescription>
          </DialogHeader>
          {sapSyncResult && (
            <ScrollArea className="flex-1 max-h-[65vh] pr-4">
              <div className="space-y-3 py-4">
                {(sapSyncResult.ACC_RES || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No ACC_RES rows returned from SAP.</p>
                )}
                {(sapSyncResult.ACC_RES || []).map((r: any, i: number) => {
                  const isSuccess = r.MSGTYP === 'S';
                  const dup = isPanDuplicateResponse(r);
                  const longMsg = r.LONGMSG || r.MSG || '';
                  const sapCode = r.VENDOR ?? r.BP_LIFNR ?? '';
                  if (isSuccess && (sapCode || r.BPNAME)) {
                    return (
                      <SuccessVendorTable
                        key={i}
                        sapCode={sapCode}
                        bpName={r.BPNAME}
                        refNo={r.REFER_NUM}
                        message={longMsg}
                      />
                    );
                  }
                  if (dup.matched && dup.msgText) {
                    return <DuplicateVendorTable key={i} msgText={dup.msgText} />;
                  }
                  return (
                    <div key={i} className="bg-muted rounded-lg p-3 text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{longMsg}</span>
                        <Badge variant={isSuccess ? 'default' : 'destructive'}>
                          {isSuccess ? 'Success' : 'Error'}
                        </Badge>
                      </div>
                      {sapCode && <p className="text-xs text-muted-foreground">SAP Vendor Code: <span className="font-mono font-semibold">{sapCode}</span></p>}
                      {r.BPNAME && <p className="text-xs text-muted-foreground">Business Partner: {r.BPNAME}</p>}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button onClick={() => { setShowSapResultDialog(false); setSelectedVendor(null); setSapSyncResult(null); }} className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk SAP Sync Result Dialog */}
      <Dialog open={showBulkResult} onOpenChange={setShowBulkResult}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-6 w-6 text-blue-600" />
              Multiple SAP Sync Result
            </DialogTitle>
            <DialogDescription>{bulkResult?.message}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[65vh] pr-4">
            <div className="space-y-3 py-4">
              {((bulkResult?.results || bulkResult?.ACC_RES || [])).length === 0 && (
                <p className="text-sm text-muted-foreground">No ACC_RES rows returned from SAP.</p>
              )}
              {(bulkResult?.results || bulkResult?.ACC_RES || []).map((item: any, i: number) => {
                const r = item?.raw || item;
                const success = item?.success ?? (r?.MSGTYP === 'S');
                const ref = item?.refNo || getSapRowRef(r) || getSapRowRef(item?.totRaw);
                const message = item?.message || getSapRowMessage(r) || getSapRowMessage(item?.totRaw) || 'No message returned from SAP';
                const sapCode = r.VENDOR ?? r.BP_LIFNR ?? '';
                const dup = isPanDuplicateResponse(item?.sapResponse || item);
                if (success && (sapCode || r.BPNAME)) {
                  return <SuccessVendorTable key={i} sapCode={sapCode} bpName={r.BPNAME} refNo={ref} message={message} />;
                }
                if (dup.matched && dup.msgText) {
                  return <DuplicateVendorTable key={i} msgText={dup.msgText} />;
                }
                return (
                <div key={i} className="bg-muted rounded-lg p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{message}</span>
                    <Badge variant={success ? 'default' : 'destructive'}>
                      {success ? 'Success' : 'Error'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {ref && <p>Ref No: <span className="font-mono">{ref}</span></p>}
                    {sapCode && <p>SAP Vendor Code: <span className="font-mono font-semibold">{sapCode}</span></p>}
                  </div>
                </div>
              );})}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => { setShowBulkResult(false); setActiveTab('dms'); }} className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500">
              Done — Go to DMS Sync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DMS Sync Result Dialog */}
      <Dialog open={showDmsResult} onOpenChange={setShowDmsResult}>
        <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderUp className="h-6 w-6 text-emerald-600" />
              DMS Sync Result
            </DialogTitle>
            <DialogDescription>{dmsResult?.message}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[65vh] pr-4">
            <div className="space-y-3 py-4">
              {(dmsResult?.results || []).map((r: any, i: number) => (
                <div key={i} className="bg-muted rounded-lg p-3 text-sm space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{r.message}</span>
                    <Badge variant={r.success ? 'default' : 'destructive'}>
                      {r.success ? 'Success' : 'Failed'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    SAP Vendor Code: <span className="font-mono">{r.VENDOR ?? r.BP_LIFNR ?? r.sap?.VENDOR ?? r.sap?.BP_LIFNR ?? '-'}</span> • Uploaded: {r.uploadedCount}
                  </p>
                  {r.sap && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs bg-background rounded-md p-2 border">
                      {(r.sap.VENDOR || r.sap.BP_LIFNR) && (
                        <div><span className="text-muted-foreground">SAP Vendor Code:</span> <span className="font-mono font-medium">{r.sap.VENDOR ?? r.sap.BP_LIFNR}</span></div>
                      )}
                      {r.sap.MSGTYP && (
                        <div><span className="text-muted-foreground">Type:</span> <span className="font-mono">{r.sap.MSGTYP}</span></div>
                      )}
                      {r.sap.ERDAT && (
                        <div><span className="text-muted-foreground">Date:</span> <span className="font-mono">{r.sap.ERDAT}</span></div>
                      )}
                      {r.sap.UZEIT && (
                        <div><span className="text-muted-foreground">Time:</span> <span className="font-mono">{r.sap.UZEIT}</span></div>
                      )}
                      {r.sap.UNAME && (
                        <div className="col-span-2"><span className="text-muted-foreground">User:</span> <span className="font-mono">{r.sap.UNAME}</span></div>
                      )}
                      {r.sap.MSG && (
                        <div className="col-span-2"><span className="text-muted-foreground">SAP MSG:</span> <span>{r.sap.MSG}</span></div>
                      )}
                    </div>
                  )}
                  {r.skipped?.length > 0 && (
                    <p className="text-xs text-amber-600">Skipped: {r.skipped.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button onClick={() => setShowDmsResult(false)} className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ApprovalCommentsDialog
        open={!!commentsVendor}
        onOpenChange={(o) => { if (!o) setCommentsVendor(null); }}
        vendorId={commentsVendor?.id ?? null}
        vendorName={commentsVendor ? (formatVendorName(commentsVendor) || "Vendor") : undefined}
        referenceNumber={(commentsVendor as any)?.reference_number || commentsVendor?.id.slice(0, 8).toUpperCase()}
      />
    </div>
  );
}
