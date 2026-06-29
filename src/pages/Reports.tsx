import { useState } from 'react';
import { format } from 'date-fns';
import {
  CalendarIcon, FileSpreadsheet, FileText, Search, RefreshCw,
  Building2, Landmark, MapPin, Mail, ShieldCheck, FolderOpen,
  Tag, Globe2, ClipboardCheck, Eye, Download, ArrowLeft,
  CheckCircle2, Circle, XCircle, Clock, MinusCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

function fmtValue(v: any): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

export default function Reports() {
  const { toast } = useToast();
  const [mode, setMode] = useState<'single' | 'all'>('all');
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [statuses, setStatuses] = useState<string[]>([]);
  const [refNum, setRefNum] = useState('');
  const [rows, setRows] = useState<VendorReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

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
        from: !isSingle && fromDate ? fromDate.toISOString() : null,
        to: !isSingle && toDate ? new Date(toDate.getTime() + 86_399_000).toISOString() : null,
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
    setFromDate(undefined); setToDate(undefined);
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
            <div>
              <Label className="text-xs">Mode</Label>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as any)}
                className="flex gap-6 mt-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="single" id="m-single" />
                  <Label htmlFor="m-single" className="cursor-pointer">Single Vendor (Reference #)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="all" id="m-all" />
                  <Label htmlFor="m-all" className="cursor-pointer">All Vendors</Label>
                </div>
              </RadioGroup>
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
                <div>
                  <Label className="text-xs">From Date</Label>
                  <Popover modal>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn('w-full justify-start text-left font-normal mt-1', !fromDate && 'text-muted-foreground')}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fromDate ? format(fromDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start" sideOffset={8}>
                      <Calendar
                        mode="single"
                        selected={fromDate}
                        onSelect={(d) => setFromDate(d ?? undefined)}
                        disabled={(date) => (toDate ? date > toDate : false)}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-xs">To Date</Label>
                  <Popover modal>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn('w-full justify-start text-left font-normal mt-1', !toDate && 'text-muted-foreground')}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {toDate ? format(toDate, 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start" sideOffset={8}>
                      <Calendar
                        mode="single"
                        selected={toDate}
                        onSelect={(d) => setToDate(d ?? undefined)}
                        disabled={(date) => (fromDate ? date < fromDate : false)}
                        initialFocus
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
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
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => run()} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                {loading ? 'Running…' : 'Run Report'}
              </Button>
              <Button variant="outline" onClick={reset} disabled={loading}>
                <RefreshCw className="h-4 w-4 mr-2" /> Reset
              </Button>
              <Button variant="outline" onClick={() => exportVendorExcel(rows, 'vendor')} disabled={rows.length === 0}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
              </Button>
              <Button variant="outline" onClick={() => exportVendorPdf(rows, 'vendor')} disabled={rows.length === 0}>
                <FileText className="h-4 w-4 mr-2" /> PDF
              </Button>
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
          <SingleVendorView row={single} />
          <ApprovalFlowTimeline row={single} />
        </>
      )}

      {!loading && mode === 'all' && rows.length > 0 && (
        <>
          <AllVendorsTable rows={rows} onView={viewVendor} />
          <AllVendorsApprovalMatrix rows={rows} />
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
                    <Eye className="h-4 w-4 mr-1" /> View
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
  fields: Array<[string, string]>;
  show?: (d: any) => boolean;
};

const SECTIONS: SectionDef[] = [
  {
    title: 'Organization Details',
    icon: Building2,
    fields: [
      ['Legal Name', 'legal_name'],
      ['Trade Name', 'trade_name'],
      ['Vendor Type', 'vendor_type'],
      ['CIN', 'cin'],
      ['Incorporation Date', 'incorporation_date'],
      ['Website', 'website'],
      ['Business Type', 'business_type'],
    ],
  },
  {
    title: 'PAN Details',
    icon: FileText,
    fields: [
      ['PAN', 'pan'],
      ['PAN Holder Name', 'pan_holder_name'],
    ],
  },
  {
    title: 'GST Details',
    icon: FileText,
    fields: [
      ['GSTIN', 'gstin'],
      ['GST Registration Type', 'gst_registration_type'],
      ['Place of Supply', 'place_of_supply'],
    ],
  },
  {
    title: 'MSME Details',
    icon: ShieldCheck,
    fields: [
      ['MSME Registered', 'is_msme_registered'],
      ['MSME Number', 'msme_number'],
      ['MSME Category', 'msme_category'],
      ['MSME Type', 'msme_type'],
    ],
  },
  {
    title: 'Bank Details',
    icon: Landmark,
    fields: [
      ['Bank Name', 'bank_name'],
      ['Branch', 'bank_branch'],
      ['IFSC', 'ifsc_code'],
      ['Account Number', 'account_number'],
      ['Account Type', 'account_type'],
      ['Beneficiary Name', 'beneficiary_name'],
    ],
  },
  {
    title: 'Registered / Corporate Office Address',
    icon: MapPin,
    fields: [
      ['Address Line 1', 'registered_address_line1'],
      ['Address Line 2', 'registered_address_line2'],
      ['City', 'registered_city'],
      ['State', 'registered_state'],
      ['Country', 'registered_country'],
      ['Pincode', 'registered_pincode'],
    ],
  },
  {
    title: 'Communication Address',
    icon: MapPin,
    fields: [
      ['Address Line 1', 'communication_address_line1'],
      ['Address Line 2', 'communication_address_line2'],
      ['City', 'communication_city'],
      ['State', 'communication_state'],
      ['Country', 'communication_country'],
      ['Pincode', 'communication_pincode'],
    ],
  },
  {
    title: 'Contact Details',
    icon: Mail,
    fields: [
      ['Primary Contact Name', 'primary_contact_name'],
      ['Primary Email', 'primary_email'],
      ['Primary Phone', 'primary_phone'],
      ['Finance Contact Name', 'finance_contact_name'],
      ['Finance Email', 'finance_email'],
      ['Finance Phone', 'finance_phone'],
      ['Technical Contact Name', 'technical_contact_name'],
      ['Technical Email', 'technical_email'],
      ['Technical Phone', 'technical_phone'],
    ],
  },
  {
    title: 'Classification Details',
    icon: Tag,
    fields: [
      ['Vendor Category', 'vendor_category'],
      ['Vendor Sub Category', 'vendor_sub_category'],
      ['Industry Sector', 'industry_sector'],
      ['Service Type', 'service_type'],
    ],
  },
  {
    title: 'Tax & Compliance',
    icon: ShieldCheck,
    fields: [
      ['TDS Section', 'tds_section'],
      ['Lower Deduction Certificate', 'lower_deduction_certificate'],
      ['Tax Residency', 'tax_residency'],
    ],
  },
  {
    title: 'International Details',
    icon: Globe2,
    show: (d) => (d.vendor_type ?? 'domestic') === 'international',
    fields: [
      ['IBAN', 'iban'],
      ['SWIFT Code', 'swift_code'],
      ['Intermediary Bank', 'intermediary_bank'],
      ['Correspondent Bank', 'correspondent_bank'],
      ['Tax Jurisdiction', 'tax_jurisdiction'],
    ],
  },
];

function SingleVendorView({ row }: { row: VendorReportRow }) {
  const d = row.details ?? {};

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
        {SECTIONS.filter((s) => !s.show || s.show(d)).map((section) => {
          const filled = section.fields.filter(([, k]) => {
            const v = d[k];
            return v !== null && v !== undefined && v !== '';
          });
          if (filled.length === 0) return null;
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
                {filled.map(([label, key]) => (
                  <Info key={key} label={label} value={fmtValue(d[key])} />
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
