import { useEffect, useState } from 'react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  FileSpreadsheet, FileText, Search, RefreshCw,
  Building2, Landmark, MapPin, Mail, ShieldCheck, FolderOpen,
  Tag, Globe2, ClipboardCheck, Eye, Download, ArrowLeft,
  CheckCircle2, Circle, XCircle, Clock, MinusCircle, Info as InfoIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { MultiSelect } from '@/components/ui/multi-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  loadVendorReports, STAGE_ORDER, STAGE_LABEL,
  type VendorReportRow,
} from '@/lib/reports/loadVendorReport';
import { exportVendorExcel } from '@/lib/reports/exportExcel';
import { exportVendorPdf } from '@/lib/reports/exportPdf';
import { formatPanStatus, formatAadhaarLinked } from '@/lib/panComprehensive';
import { useReportsScreenConfig, DEFAULT_REPORTS_SCREEN_CONFIG } from '@/hooks/useScreenConfig';



type ReportType = 'vendor' | 'approval' | 'both';


const STATUS_OPTIONS = [
  'draft', 'submitted', 'buyer_review',
  'scm_manager_review', 'scm_head_review',
  'finance_1_review', 'finance_2_review', 'ceo_office_review',
  'pending_sap_sync', 'sap_synced', 'dms_synced',
  'returned_to_vendor', 'returned_to_buyer',
  'scm_manager_rejected', 'scm_head_rejected',
  'finance_1_rejected', 'finance_2_rejected',
  'ceo_office_rejected', 'sap_team_rejected',
].map((s) => ({ value: s, label: s.replace(/_/g, ' ') }));

function statusVariant(s: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'approved' || s === 'sap_synced' || s === 'dms_synced') return 'secondary';
  if (s === 'rejected' || s === 'returned' || s.endsWith('_rejected')) return 'destructive';
  if (s === 'pending') return 'outline';
  return 'default';
}

function statusLabel(s: string): string {
  if (s === 'pending') return 'Pending';
  if (s === 'approved') return 'Approved';
  if (s === 'rejected') return 'Rejected';
  if (s === 'returned') return 'Returned';
  return s.replace(/_/g, ' ');
}

function fmt(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

function fmtValue(v: any, key?: string): string {
  if (key === 'pan_aadhaar_linked') return formatAadhaarLinked(v as any) ?? '';
  if (key === 'pan_status') return formatPanStatus(v as any) ?? '';
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

export default function Reports() {
  const { toast } = useToast();
  const [mode, setMode] = useState<'single' | 'all'>('all');
  const [reportType, setReportType] = useState<ReportType>('both');
  const [dateFrom, setDateFrom] = useState<Date | null>(() => startOfDay(subDays(new Date(), 30)));
  const [dateTo, setDateTo] = useState<Date | null>(() => endOfDay(new Date()));
  const [statuses, setStatuses] = useState<string[]>([]);
  const [refNum, setRefNum] = useState('');
  const [rows, setRows] = useState<VendorReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const toInputValue = (d: Date | null) => (d ? format(d, 'yyyy-MM-dd') : '');


  const run = async (overrideRef?: string) => {
    const refValue = overrideRef ?? (mode === 'single' ? refNum.trim() : '');
    const isSingle = !!overrideRef || mode === 'single';
    if (isSingle && !refValue) {
      toast({ title: 'Reference Number required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const data = await loadVendorReports({
        from: !isSingle && dateFrom ? startOfDay(dateFrom).toISOString() : null,
        to: !isSingle && dateTo ? endOfDay(dateTo).toISOString() : null,

        statuses: !isSingle ? statuses : undefined,
        referenceNumber: isSingle ? refValue : null,
      });
      setRows(data);
      setHasRun(true);
      if (data.length === 0) toast({ title: 'No vendors match the filters' });
    } catch (e: any) {
      toast({ title: 'Failed to load report', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setDateFrom(startOfDay(subDays(new Date(), 30)));
    setDateTo(endOfDay(new Date()));
    setStatuses([]); setRefNum(''); setRows([]); setHasRun(false);
  };


  const viewVendor = async (ref: string) => {
    setMode('single');
    setRefNum(ref);
    await run(ref);
  };

  const backToList = () => {
    setMode('all');
    setRefNum('');
    setRows([]);
    setHasRun(false);
  };

  const single = mode === 'single' ? rows[0] : null;
  const showVendor = reportType === 'vendor' || reportType === 'both';
  const showApproval = reportType === 'approval' || reportType === 'both';

  const { data: screenCfg } = useReportsScreenConfig();
  const cfg = screenCfg ?? DEFAULT_REPORTS_SCREEN_CONFIG;

  // If the current Report Type is hidden by config, fall back to the first visible one.
  useEffect(() => {
    const map: Record<ReportType, boolean> = {
      vendor: cfg.report_type_vendor,
      approval: cfg.report_type_approval,
      both: cfg.report_type_both,
    };
    if (!map[reportType]) {
      const fallback = (['both', 'vendor', 'approval'] as ReportType[]).find((t) => map[t]);
      if (fallback) setReportType(fallback);
    }
  }, [cfg.report_type_vendor, cfg.report_type_approval, cfg.report_type_both, reportType]);

  // If the current Scope is hidden, fall back.
  useEffect(() => {
    if (mode === 'single' && !cfg.scope_single && cfg.scope_all) setMode('all');
    else if (mode === 'all' && !cfg.scope_all && cfg.scope_single) setMode('single');
  }, [cfg.scope_single, cfg.scope_all, mode]);




  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vendor registration details and approval audit trail.
          </p>
        </div>
        {single && (
          <Button variant="outline" size="sm" onClick={backToList}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to all vendors
          </Button>
        )}
      </div>

      {!single && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Report Type</Label>
                <RadioGroup
                  value={reportType}
                  onValueChange={(v) => setReportType(v as ReportType)}
                  className="flex flex-wrap gap-4 mt-2"
                >
                  {cfg.report_type_vendor && (
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="vendor" id="rt-vendor" />
                      <Label htmlFor="rt-vendor" className="cursor-pointer">Vendor Report</Label>
                    </div>
                  )}
                  {cfg.report_type_approval && (
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="approval" id="rt-approval" />
                      <Label htmlFor="rt-approval" className="cursor-pointer">Approval Flow Report</Label>
                    </div>
                  )}
                  {cfg.report_type_both && (
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="both" id="rt-both" />
                      <Label htmlFor="rt-both" className="cursor-pointer">Both</Label>
                    </div>
                  )}

                </RadioGroup>
              </div>
              <div>
                <Label className="text-xs">Scope</Label>
                <RadioGroup
                  value={mode}
                  onValueChange={(v) => setMode(v as any)}
                  className="flex flex-wrap gap-4 mt-2"
                >
                  {cfg.scope_single && (
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="single" id="m-single" />
                      <Label htmlFor="m-single" className="cursor-pointer">Single Vendor (Reference #)</Label>
                    </div>
                  )}
                  {cfg.scope_all && (
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="all" id="m-all" />
                      <Label htmlFor="m-all" className="cursor-pointer">All Vendors</Label>
                    </div>
                  )}

                </RadioGroup>
              </div>
            </div>

            {mode === 'single' ? (
              <div className="max-w-sm">
                <Label className="text-xs">Reference Number</Label>
                <Input
                  value={refNum}
                  onChange={(e) => setRefNum(e.target.value)}
                  placeholder="e.g. 20260629001"
                  className="mt-1"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {cfg.filter_from_date && (
                  <div>
                    <Label className="text-xs">From</Label>
                    <Input
                      type="date"
                      className="mt-1"
                      value={toInputValue(dateFrom)}
                      max={toInputValue(dateTo)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) { setDateFrom(null); return; }
                        const d = startOfDay(new Date(val));
                        setDateFrom(d);
                        if (dateTo && d > dateTo) setDateTo(endOfDay(d));
                      }}
                    />
                  </div>
                )}
                {cfg.filter_to_date && (
                  <div>
                    <Label className="text-xs">To</Label>
                    <Input
                      type="date"
                      className="mt-1"
                      value={toInputValue(dateTo)}
                      min={toInputValue(dateFrom)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) { setDateTo(null); return; }
                        const d = endOfDay(new Date(val));
                        setDateTo(d);
                        if (dateFrom && d < dateFrom) setDateFrom(startOfDay(new Date(val)));
                      }}
                    />
                  </div>
                )}
                {cfg.filter_vendor_status && (
                  <div>
                    <Label className="text-xs">Vendor Status</Label>
                    <div className="mt-1">
                      <MultiSelect
                        options={STATUS_OPTIONS}
                        selected={statuses}
                        onChange={setStatuses}
                        placeholder="All statuses"
                      />
                    </div>
                  </div>
                )}

              </div>

            )}

            <div className="flex flex-wrap gap-2 pt-2">
              {cfg.action_run && (
                <Button onClick={() => run()} disabled={loading}>
                  <Search className="h-4 w-4 mr-2" />
                  {loading ? 'Running…' : 'Run Report'}
                </Button>
              )}
              {cfg.action_reset && (
                <Button variant="outline" onClick={reset} disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Reset
                </Button>
              )}
              {cfg.action_excel && (
                <Button variant="outline" onClick={() => exportVendorExcel(rows, reportType)} disabled={rows.length === 0}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
                </Button>
              )}
              {cfg.action_pdf && (
                <Button variant="outline" onClick={() => exportVendorPdf(rows, reportType)} disabled={rows.length === 0}>
                  <FileText className="h-4 w-4 mr-2" /> PDF
                </Button>
              )}
            </div>

          </CardContent>

        </Card>
      )}

      {loading && <Skeleton className="h-64 w-full" />}

      {!loading && hasRun && rows.length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No results.</CardContent></Card>
      )}

      {!loading && single && (
        <>
          {(cfg.action_excel || cfg.action_pdf) && (
            <Card>
              <CardContent className="flex flex-wrap gap-2 py-3">
                {cfg.action_excel && (
                  <Button variant="outline" size="sm" onClick={() => exportVendorExcel([single], reportType)}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
                  </Button>
                )}
                {cfg.action_pdf && (
                  <Button variant="outline" size="sm" onClick={() => exportVendorPdf([single], reportType)}>
                    <FileText className="h-4 w-4 mr-2" /> PDF
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {showVendor && <SingleVendorView row={single} />}
          {showApproval && <ApprovalFlowTimeline row={single} />}
        </>
      )}


      {!loading && mode === 'all' && rows.length > 0 && (
        <>
          {showVendor && <AllVendorsTable rows={rows} onView={viewVendor} />}
          {showApproval && <AllVendorsApprovalMatrix rows={rows} />}

        </>
      )}
    </div>
  );
}

// =================== All Vendors — Vendor Report ===================

function AllVendorsTable({ rows, onView }: { rows: VendorReportRow[]; onView: (ref: string) => void }) {
  return (
    <Card>
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Vendor Report ({rows.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ref #</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Invited</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Current Stage</TableHead>
              <TableHead>Final Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.vendor_id}>
                <TableCell className="font-mono text-xs">{r.reference_number}</TableCell>
                <TableCell className="font-medium">{r.vendor_name}</TableCell>
                <TableCell><Badge variant="outline">{r.vendor_type}</Badge></TableCell>
                <TableCell className="text-xs">{fmt(r.invited_at)}</TableCell>
                <TableCell className="text-xs">{fmt(r.submitted_at)}</TableCell>
                <TableCell><Badge variant="outline">{r.current_stage}</Badge></TableCell>
                <TableCell><Badge variant={statusVariant(r.final_status)}>{r.final_status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => onView(r.reference_number)}>
                    <Eye className="h-4 w-4 mr-1" /> View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// =================== All Vendors — Approval Flow Matrix ===================

function AllVendorsApprovalMatrix({ rows }: { rows: VendorReportRow[] }) {
  return (
    <Card>
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Approval Flow Report
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10">Ref #</TableHead>
              <TableHead className="sticky left-[100px] bg-background z-10">Vendor</TableHead>
              {STAGE_ORDER.map((s) => <TableHead key={s}>{STAGE_LABEL[s]}</TableHead>)}
              <TableHead>Current Stage</TableHead>
              <TableHead>Final</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.vendor_id}>
                <TableCell className="font-mono text-xs sticky left-0 bg-background">{r.reference_number}</TableCell>
                <TableCell className="text-xs sticky left-[100px] bg-background">{r.vendor_name}</TableCell>
                {STAGE_ORDER.map((s) => {
                  const i = r.stages[s];
                  if (i.status === 'skipped') {
                    return <TableCell key={s} className="text-center text-muted-foreground">—</TableCell>;
                  }
                  return (
                    <TableCell key={s} className="text-xs align-top" title={i.remarks}>
                      <Badge variant={statusVariant(i.status)} className="mb-1">{statusLabel(i.status)}</Badge>
                      <div className="text-[10px] text-muted-foreground">{i.approver_name}</div>
                      {i.acted_at && <div className="text-[10px] text-muted-foreground">{fmt(i.acted_at)}</div>}
                    </TableCell>
                  );
                })}
                <TableCell><Badge variant="outline">{r.current_stage}</Badge></TableCell>
                <TableCell><Badge variant={statusVariant(r.final_status)}>{r.final_status}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// =================== Single Vendor — Detail Cards ===================

type SectionDef = {
  title: string;
  icon: any;
  // Known labels (preferred order/wording). Any matching key not listed is auto-appended.
  knownLabels?: Record<string, string>;
  match: (key: string) => boolean;
  show?: (d: any) => boolean;
};

// Internal / noise columns we should never display.
const HIDDEN_KEYS = new Set<string>([
  'id', 'user_id', 'tenant_id', 'created_at', 'updated_at', 'submitted_at',
  'invited_at', 'reference_number', 'legal_name', 'trade_name',
  'vendor_type', 'status', 'primary_email',
  'metadata', 'token', 'session_id',
]);

const SECTIONS: SectionDef[] = [
  {
    title: 'Organization Details',
    icon: Building2,
    knownLabels: {
      legal_name: 'Legal Name',
      trade_name: 'Trade Name',
      vendor_type: 'Vendor Type',
      cin: 'CIN',
      llpin: 'LLPIN',
      incorporation_date: 'Incorporation Date',
      date_of_incorporation: 'Date of Incorporation',
      website: 'Website',
      business_type: 'Business Type',
      constitution_of_business: 'Constitution of Business',
      industry_sector: 'Industry Sector',
      establishment_year: 'Establishment Year',
      number_of_employees: 'Number of Employees',
      annual_turnover: 'Annual Turnover',
    },
    match: (k) =>
      ['cin', 'llpin', 'incorporation_date', 'date_of_incorporation', 'website',
       'business_type', 'constitution_of_business', 'establishment_year',
       'number_of_employees', 'annual_turnover', 'industry_sector',
       'company_type', 'organization_type'].includes(k),
  },
  {
    title: 'PAN Details',
    icon: FileText,
    knownLabels: {
      pan: 'PAN',
      pan_number: 'PAN Number',
      pan_holder_name: 'PAN Holder Name',
      pan_status: 'PAN Status',
      pan_aadhaar_linked: 'Is Aadhaar Linked',
      pan_comprehensive_verified_at: 'PAN Comprehensive Verified At',
      pan_verified: 'PAN Verified',
      pan_verified_at: 'PAN Verified At',
    },
    match: (k) => k === 'pan' || k.startsWith('pan_'),
  },
  {
    title: 'GST Details',
    icon: FileText,
    knownLabels: {
      gstin: 'GSTIN',
      gst_number: 'GST Number',
      gst_status: 'GST Status',
      gst_registration_type: 'GST Registration Type',
      gst_registered: 'GST Registered',
      legal_name_as_per_gst: 'Legal Name (as per GST)',
      trade_name_as_per_gst: 'Trade Name (as per GST)',
      place_of_supply: 'Place of Supply',
      gst_filing_status: 'GST Filing Status',
      gst_verified: 'GST Verified',
      gst_verified_at: 'GST Verified At',
    },
    match: (k) => k === 'gstin' || k.includes('gst'),
  },
  {
    title: 'MSME Details',
    icon: ShieldCheck,
    knownLabels: {
      is_msme_registered: 'MSME Registered',
      msme_number: 'MSME / Udyam Number',
      udyam_number: 'Udyam Number',
      msme_category: 'MSME Category',
      msme_type: 'Enterprise Type',
      msme_enterprise_type: 'Enterprise Type',
      msme_registration_date: 'MSME Registration Date',
      msme_verified: 'MSME Verified',
      msme_verified_at: 'MSME Verified At',
    },
    match: (k) => k.includes('msme') || k.includes('udyam'),
  },
  {
    title: 'Bank Details',
    icon: Landmark,
    knownLabels: {
      bank_name: 'Bank Name',
      bank_branch: 'Branch',
      branch_name: 'Branch Name',
      branch_address: 'Branch Address',
      ifsc_code: 'IFSC Code',
      account_number: 'Account Number',
      account_type: 'Account Type',
      account_holder_name: 'Account Holder Name',
      beneficiary_name: 'Beneficiary Name',
      micr_code: 'MICR Code',
      swift_code: 'SWIFT Code',
      iban: 'IBAN',
      upi_id: 'UPI ID',
      penny_drop_status: 'Penny Drop Status',
      penny_drop_verified_at: 'Penny Drop Verified At',
    },
    match: (k) =>
      k.startsWith('bank_') || k.startsWith('account_') || k.startsWith('branch_') ||
      k.startsWith('ifsc') || k.startsWith('micr') || k.startsWith('upi') ||
      k.startsWith('penny') || k === 'beneficiary_name',
  },
  {
    title: 'Registered Office Address',
    icon: MapPin,
    knownLabels: {
      registered_address_line1: 'Address Line 1',
      registered_address_line2: 'Address Line 2',
      registered_city: 'City',
      registered_state: 'State',
      registered_country: 'Country',
      registered_pincode: 'Pincode',
    },
    match: (k) => k.startsWith('registered_'),
  },
  {
    title: 'Corporate Office Address',
    icon: MapPin,
    knownLabels: {
      corporate_address_line1: 'Address Line 1',
      corporate_address_line2: 'Address Line 2',
      corporate_city: 'City',
      corporate_state: 'State',
      corporate_country: 'Country',
      corporate_pincode: 'Pincode',
    },
    match: (k) => k.startsWith('corporate_'),
  },
  {
    title: 'Communication Address',
    icon: MapPin,
    knownLabels: {
      communication_address_line1: 'Address Line 1',
      communication_address_line2: 'Address Line 2',
      communication_city: 'City',
      communication_state: 'State',
      communication_country: 'Country',
      communication_pincode: 'Pincode',
    },
    match: (k) => k.startsWith('communication_'),
  },
  {
    title: 'Contact Details',
    icon: Mail,
    knownLabels: {
      primary_contact_name: 'Primary Contact Name',
      primary_phone: 'Primary Phone',
      primary_designation: 'Primary Designation',
      finance_contact_name: 'Finance Contact Name',
      finance_email: 'Finance Email',
      finance_phone: 'Finance Phone',
      technical_contact_name: 'Technical Contact Name',
      technical_email: 'Technical Email',
      technical_phone: 'Technical Phone',
      alternate_email: 'Alternate Email',
      alternate_phone: 'Alternate Phone',
    },
    match: (k) =>
      k.startsWith('primary_') || k.startsWith('finance_contact') || k.startsWith('finance_email') ||
      k.startsWith('finance_phone') || k.startsWith('technical_') ||
      k.startsWith('alternate_') || k.startsWith('contact_') || k.includes('designation') ||
      k.endsWith('_phone') || k.endsWith('_email'),
  },
  {
    title: 'Classification Details',
    icon: Tag,
    knownLabels: {
      vendor_category: 'Vendor Category',
      vendor_sub_category: 'Vendor Sub Category',
      service_type: 'Service Type',
      payment_terms: 'Payment Terms',
      currency: 'Currency',
      preferred_currency: 'Preferred Currency',
      buyer_company: 'Buyer Company',
    },
    match: (k) =>
      k.startsWith('vendor_category') || k.startsWith('vendor_sub') || k.includes('classification') ||
      k.includes('category') || k.includes('subcategory') ||
      ['service_type', 'payment_terms', 'currency', 'preferred_currency', 'buyer_company'].includes(k),
  },
  {
    title: 'Tax & Compliance',
    icon: ShieldCheck,
    knownLabels: {
      tds_section: 'TDS Section',
      tds_rate: 'TDS Rate',
      lower_deduction_certificate: 'Lower Deduction Certificate',
      tax_residency: 'Tax Residency',
      tan_number: 'TAN Number',
    },
    match: (k) =>
      k.startsWith('tds_') || k.startsWith('tan_') || k.includes('compliance') ||
      ['lower_deduction_certificate', 'tax_residency'].includes(k),
  },
  {
    title: 'International Details',
    icon: Globe2,
    show: (d) => (d.vendor_type ?? 'domestic') === 'international',
    knownLabels: {
      intermediary_bank: 'Intermediary Bank',
      correspondent_bank: 'Correspondent Bank',
      tax_jurisdiction: 'Tax Jurisdiction',
      country_of_residence: 'Country of Residence',
      lut_number: 'LUT Number',
      dtaa_applicable: 'DTAA Applicable',
    },
    match: (k) =>
      k.startsWith('intermediary_') || k.startsWith('correspondent_') ||
      k.startsWith('tax_jurisdiction') || k.startsWith('country_of_') ||
      k.startsWith('lut_') || k.startsWith('dtaa'),
  },
];

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildSectionData(d: Record<string, any>) {
  const consumed = new Set<string>(HIDDEN_KEYS);
  const result = SECTIONS.map((section) => {
    if (section.show && !section.show(d)) return null;
    const entries: Array<[string, string]> = [];
    // Preserve known label order first.
    if (section.knownLabels) {
      for (const [key, label] of Object.entries(section.knownLabels)) {
        if (consumed.has(key)) continue;
        const v = d[key];
        if (v === null || v === undefined || v === '') continue;
        entries.push([label, fmtValue(v, key)]);
        consumed.add(key);
      }
    }
    // Auto-include anything else matching this section.
    for (const [key, value] of Object.entries(d)) {
      if (consumed.has(key)) continue;
      if (!section.match(key)) continue;
      if (value === null || value === undefined || value === '') continue;
      if (typeof value === 'object' && !Array.isArray(value)) {
        entries.push([humanize(key), JSON.stringify(value)]);
      } else {
        entries.push([humanize(key), fmtValue(value, key)]);
      }
      consumed.add(key);
    }
    if (entries.length === 0) return null;
    return { title: section.title, icon: section.icon, entries };
  }).filter(Boolean) as Array<{ title: string; icon: any; entries: Array<[string, string]> }>;

  // Fallback: any remaining captured field goes to "Other Details".
  const other: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(d)) {
    if (consumed.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    if (key.endsWith('_id') || key.endsWith('_token')) continue;
    if (typeof value === 'object') {
      other.push([humanize(key), JSON.stringify(value)]);
    } else {
      other.push([humanize(key), fmtValue(value, key)]);
    }
  }
  if (other.length > 0) {
    result.push({ title: 'Other Details', icon: InfoIcon, entries: other });
  }
  return result;
}

function SingleVendorView({ row }: { row: VendorReportRow }) {
  const d = row.details ?? {};
  const sections = buildSectionData(d);

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <Card className="border-primary/20">
        <CardHeader className="border-b bg-primary/5">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {row.vendor_name}
            <Badge variant="outline" className="ml-2 font-mono text-xs">{row.reference_number}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm pt-4">
          <Info label="Vendor Type" value={row.vendor_type} />
          <Info label="Invited Email" value={row.invited_email} />
          <Info label="Invited At" value={fmt(row.invited_at)} />
          <Info label="Submitted At" value={fmt(row.submitted_at)} />
          <Info label="On Behalf" value={row.on_behalf ? 'Yes' : 'No'} />
          <Info label="Current Stage" value={row.current_stage} />
          <Info label="Final Status" value={row.final_status} />
        </CardContent>
      </Card>

      {/* Section cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title}>
              <CardHeader className="border-b bg-muted/30 py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-4">
                {section.entries.map(([label, value]) => (
                  <Info key={label} label={label} value={value} />
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>


      {/* Documents */}
      {row.documents && row.documents.length > 0 && (
        <Card>
          <CardHeader className="border-b bg-muted/30 py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-primary" />
              Uploaded Documents ({row.documents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Type</TableHead>
                  <TableHead>File Name</TableHead>
                  <TableHead>Uploaded At</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.documents.map((doc, i) => (
                  <TableRow key={i}>
                    <TableCell className="capitalize">{doc.document_type?.replace(/_/g, ' ')}</TableCell>
                    <TableCell className="text-xs">{doc.file_name}</TableCell>
                    <TableCell className="text-xs">{fmt(doc.uploaded_at)}</TableCell>
                    <TableCell className="text-right">
                      {doc.signed_url ? (
                        <a href={doc.signed_url} target="_blank" rel="noreferrer">
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4 mr-1" /> Open
                          </Button>
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Validation Results */}
      {row.validations && row.validations.length > 0 && (
        <Card>
          <CardHeader className="border-b bg-muted/30 py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Validation Results
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Validation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verified At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {row.validations.map((v, i) => (
                  <TableRow key={i}>
                    <TableCell className="capitalize">{v.validation_type.replace(/_/g, ' ')}</TableCell>
                    <TableCell><Badge variant={statusVariant(v.status)}>{v.status}</Badge></TableCell>
                    <TableCell className="text-xs">{fmt(v.verified_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =================== Single Vendor — Approval Flow Timeline ===================

function StageIcon({ status }: { status: string }) {
  if (status === 'approved') return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (status === 'rejected') return <XCircle className="h-5 w-5 text-destructive" />;
  if (status === 'returned') return <XCircle className="h-5 w-5 text-amber-600" />;
  if (status === 'pending') return <Clock className="h-5 w-5 text-blue-600" />;
  if (status === 'skipped') return <MinusCircle className="h-5 w-5 text-muted-foreground" />;
  return <Circle className="h-5 w-5 text-muted-foreground" />;
}

function ApprovalFlowTimeline({ row }: { row: VendorReportRow }) {
  return (
    <Card>
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-primary" />
          Approval Flow Report
          <Badge variant="outline" className="ml-2">Current: {row.current_stage}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground mb-4">
          Stages marked <span className="font-medium">—</span> were not part of this vendor's approval matrix.
        </p>
        <div className="relative">
          {STAGE_ORDER.map((s, idx) => {
            const info = row.stages[s];
            const isLast = idx === STAGE_ORDER.length - 1;
            const isCurrent = info.status === 'pending';
            return (
              <div key={s} className="flex gap-4 pb-4 relative">
                {!isLast && (
                  <div className="absolute left-[10px] top-7 bottom-0 w-px bg-border" />
                )}
                <div className="flex-shrink-0 mt-0.5">
                  <StageIcon status={info.status} />
                </div>
                <div className={cn(
                  'flex-1 rounded-md border p-3 transition-colors',
                  isCurrent && 'border-primary/40 bg-primary/5',
                  info.status === 'skipped' && 'opacity-60',
                )}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="font-medium text-sm flex items-center gap-2">
                      {STAGE_LABEL[s]}
                      {isCurrent && <Badge className="text-[10px]">Current Stage</Badge>}
                    </div>
                    {info.status === 'skipped' ? (
                      <span className="text-xs text-muted-foreground">— Not in matrix</span>
                    ) : (
                      <Badge variant={statusVariant(info.status)}>{statusLabel(info.status)}</Badge>
                    )}
                  </div>
                  {info.status !== 'skipped' && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Approver</div>
                        <div className="font-medium">{info.approver_name}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">
                          {info.status === 'approved' ? 'Approved On' : info.status === 'pending' ? 'Started' : 'Acted On'}
                        </div>
                        <div className="font-medium">{fmt(info.acted_at)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Remarks</div>
                        <div className="font-medium break-words">{info.remarks || '—'}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium break-words">{value || '—'}</div>
    </div>
  );
}
