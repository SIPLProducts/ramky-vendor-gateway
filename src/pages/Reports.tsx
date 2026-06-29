import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, FileSpreadsheet, FileText, Search, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

function StageBadge({ status }: { status: string }) {
  if (status === 'skipped') return <span className="text-muted-foreground text-xs">—</span>;
  return <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>;
}

function fmt(d: string | null | undefined): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

export default function Reports() {
  const { toast } = useToast();
  const [reportType, setReportType] = useState<'vendor' | 'approval'>('vendor');
  const [mode, setMode] = useState<'single' | 'all'>('all');
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [statuses, setStatuses] = useState<string[]>([]);
  const [refNum, setRefNum] = useState('');
  const [rows, setRows] = useState<VendorReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  const run = async () => {
    if (mode === 'single' && !refNum.trim()) {
      toast({ title: 'Reference Number required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const data = await loadVendorReports({
        from: fromDate ? fromDate.toISOString() : null,
        to: toDate ? new Date(toDate.getTime() + 86_399_000).toISOString() : null,
        statuses: mode === 'all' ? statuses : undefined,
        referenceNumber: mode === 'single' ? refNum.trim() : null,
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

  const single = mode === 'single' ? rows[0] : null;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vendor registration and approval audit trail. Export to Excel or PDF.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={reportType} onValueChange={(v) => setReportType(v as any)}>
            <TabsList>
              <TabsTrigger value="vendor">Vendor Report</TabsTrigger>
              <TabsTrigger value="approval">Approval Flow Report</TabsTrigger>
            </TabsList>
          </Tabs>

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
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal mt-1', !fromDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fromDate ? format(fromDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus className={cn('p-3 pointer-events-auto')} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-xs">To Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal mt-1', !toDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {toDate ? format(toDate, 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus className={cn('p-3 pointer-events-auto')} />
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
            <Button onClick={run} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              {loading ? 'Running…' : 'Run Report'}
            </Button>
            <Button variant="outline" onClick={reset} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" /> Reset
            </Button>
            <Button variant="outline" onClick={() => exportVendorExcel(rows, reportType)} disabled={rows.length === 0}>
              <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
            </Button>
            <Button variant="outline" onClick={() => exportVendorPdf(rows, reportType)} disabled={rows.length === 0}>
              <FileText className="h-4 w-4 mr-2" /> PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && <Skeleton className="h-64 w-full" />}

      {!loading && hasRun && rows.length === 0 && (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No results.</CardContent></Card>
      )}

      {!loading && single && <SingleVendorView row={single} />}

      {!loading && mode === 'all' && rows.length > 0 && reportType === 'vendor' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Vendors ({rows.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Ref #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Current Stage</TableHead>
                <TableHead>Final Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.vendor_id}>
                    <TableCell className="font-mono text-xs">{r.reference_number}</TableCell>
                    <TableCell>{r.vendor_name}</TableCell>
                    <TableCell><Badge variant="outline">{r.vendor_type}</Badge></TableCell>
                    <TableCell className="text-xs">{fmt(r.invited_at)}</TableCell>
                    <TableCell className="text-xs">{fmt(r.submitted_at)}</TableCell>
                    <TableCell>{r.current_stage}</TableCell>
                    <TableCell><Badge variant={statusVariant(r.final_status)}>{r.final_status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!loading && mode === 'all' && rows.length > 0 && reportType === 'approval' && (
        <Card>
          <CardHeader><CardTitle className="text-base">Approval Flow ({rows.length} vendors)</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Ref #</TableHead>
                <TableHead>Vendor</TableHead>
                {STAGE_ORDER.map((s) => <TableHead key={s}>{STAGE_LABEL[s]}</TableHead>)}
                <TableHead>Final</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.vendor_id}>
                    <TableCell className="font-mono text-xs">{r.reference_number}</TableCell>
                    <TableCell className="text-xs">{r.vendor_name}</TableCell>
                    {STAGE_ORDER.map((s) => {
                      const i = r.stages[s];
                      return (
                        <TableCell key={s} className="text-xs align-top" title={i.remarks}>
                          <StageBadge status={i.status} />
                          {i.status !== 'skipped' && (
                            <>
                              <div className="text-[10px] text-muted-foreground mt-1">{i.approver_name}</div>
                              <div className="text-[10px] text-muted-foreground">{i.acted_at ? fmt(i.acted_at) : ''}</div>
                            </>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell><Badge variant={statusVariant(r.final_status)}>{r.final_status}</Badge></TableCell>
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

// -------- Single Vendor View --------

const SECTIONS: Array<{ title: string; fields: Array<[string, string]>; international?: boolean }> = [
  {
    title: 'Basic Information',
    fields: [
      ['Legal Name', 'legal_name'],
      ['Trade Name', 'trade_name'],
      ['Vendor Type', 'vendor_type'],
      ['Category', 'vendor_category'],
      ['Sub Category', 'vendor_sub_category'],
      ['PAN', 'pan'],
      ['GSTIN', 'gstin'],
      ['CIN', 'cin'],
      ['MSME Registered', 'is_msme_registered'],
      ['MSME Number', 'msme_number'],
      ['Incorporation Date', 'incorporation_date'],
      ['Website', 'website'],
    ],
  },
  {
    title: 'Registered Address',
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
    title: 'Contact Persons',
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
    title: 'Banking Details',
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
    title: 'Tax & Compliance',
    fields: [
      ['GST Registration Type', 'gst_registration_type'],
      ['TDS Section', 'tds_section'],
      ['Lower Deduction Certificate', 'lower_deduction_certificate'],
      ['Tax Residency', 'tax_residency'],
      ['Place of Supply', 'place_of_supply'],
    ],
  },
  {
    title: 'International Details',
    international: true,
    fields: [
      ['IBAN', 'iban'],
      ['SWIFT Code', 'swift_code'],
      ['Intermediary Bank', 'intermediary_bank'],
      ['Correspondent Bank', 'correspondent_bank'],
      ['Tax Jurisdiction', 'tax_jurisdiction'],
    ],
  },
];

function fmtValue(v: any): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

function SingleVendorView({ row }: { row: VendorReportRow }) {
  const d = row.details ?? {};
  const isIntl = (d.vendor_type ?? row.vendor_type) === 'international';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{row.vendor_name}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Info label="Reference #" value={row.reference_number} />
          <Info label="Vendor Type" value={row.vendor_type} />
          <Info label="Invited Email" value={row.invited_email} />
          <Info label="Invited At" value={fmt(row.invited_at)} />
          <Info label="Submitted At" value={fmt(row.submitted_at)} />
          <Info label="On Behalf" value={row.on_behalf ? 'Yes' : 'No'} />
          <Info label="Current Stage" value={row.current_stage} />
          <Info label="Final Status" value={row.final_status} />
        </CardContent>
      </Card>

      {SECTIONS.filter((s) => !s.international || isIntl).map((section) => {
        const filled = section.fields.filter(([, k]) => {
          const v = d[k];
          return v !== null && v !== undefined && v !== '';
        });
        if (filled.length === 0) return null;
        return (
          <Card key={section.title}>
            <CardHeader><CardTitle className="text-base">{section.title}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {filled.map(([label, key]) => (
                <Info key={key} label={label} value={fmtValue(d[key])} />
              ))}
            </CardContent>
          </Card>
        );
      })}

      {row.documents && row.documents.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Documents ({row.documents.length})</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Document Type</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Uploaded At</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {row.documents.map((doc, i) => (
                  <TableRow key={i}>
                    <TableCell>{doc.document_type}</TableCell>
                    <TableCell className="text-xs">{doc.file_name}</TableCell>
                    <TableCell className="text-xs">{fmt(doc.uploaded_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {row.validations && row.validations.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Validation Results</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Validation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Verified At</TableHead>
              </TableRow></TableHeader>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Stages marked <span className="font-medium">—</span> were not part of this vendor's approval matrix and were skipped.
          </p>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Stage</TableHead>
              <TableHead>Approver</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Acted At</TableHead>
              <TableHead>Remarks</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {STAGE_ORDER.map((s) => {
                const i = row.stages[s];
                const skipped = i.status === 'skipped';
                return (
                  <TableRow key={s} className={skipped ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{STAGE_LABEL[s]}</TableCell>
                    <TableCell>{skipped ? '—' : i.approver_name}</TableCell>
                    <TableCell><StageBadge status={i.status} /></TableCell>
                    <TableCell className="text-xs">{skipped ? '—' : fmt(i.acted_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{skipped ? '—' : (i.remarks || '—')}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {row.details?.last_rejection_comments && (
        <Card>
          <CardHeader><CardTitle className="text-base">Latest Comment</CardTitle></CardHeader>
          <CardContent className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md p-3">
            {row.details.last_rejection_comments}
          </CardContent>
        </Card>
      )}
    </div>
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
