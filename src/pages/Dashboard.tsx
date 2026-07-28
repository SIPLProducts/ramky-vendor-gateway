import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { formatDateTime } from '@/lib/dateFormat';
import * as XLSX from 'xlsx';
import {
  CalendarIcon,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileText,
  MessageSquare,
  XCircle,
} from 'lucide-react';
import { VendorReviewDialog } from '@/components/vendor/VendorReviewDialog';
import { ApprovalCommentsDialog } from '@/components/sap/ApprovalCommentsDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenantContext, useTenantFilter } from '@/hooks/useTenantContext';
import { cn } from '@/lib/utils';
import { pickVendorDisplayName } from '@/lib/sapPayloadBuilder';


type VendorRow = {
  id: string;
  reference_number: string | null;
  legal_name: string | null;
  trade_name: string | null;
  account_holder_name: string | null;
  gstin: string | null;
  primary_email: string | null;
  registered_email: string | null;
  status: string;
  created_at: string;
  tenant_id: string | null;
  invited_by?: { name: string | null; email: string | null } | null;
  display_email?: string | null;
};


const DRAFT_STATUSES = new Set(['draft']);

const PENDING_STATUSES = new Set([
  'submitted',
  'validation_pending',
  'buyer_review',
  'scm_manager_review',
  'scm_head_review',
  'finance_1_review',
  'finance_2_review',
  'ceo_office_review',
  'pending_sap_sync',
  'dms_sync_pending',
  'returned_to_vendor',
  'returned_to_buyer',
]);

const APPROVED_STATUSES = new Set(['sap_synced', 'dms_synced']);
const REJECTED_STATUSES = new Set(['sap_team_rejected', 'sap_team_closed']);

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  submitted: { label: 'Submitted', variant: 'secondary' },
  validation_pending: { label: 'Validating', variant: 'secondary' },
  buyer_review: { label: 'Buyer Review', variant: 'secondary' },
  scm_manager_review: { label: 'SCM CO', variant: 'secondary' },
  scm_head_review: { label: 'SCM Head Review', variant: 'secondary' },
  finance_1_review: { label: 'Finance 1 Review', variant: 'secondary' },
  finance_2_review: { label: 'Finance 2 Review', variant: 'secondary' },
  ceo_office_review: { label: 'CEO Office Review', variant: 'secondary' },
  pending_sap_sync: { label: 'Pending SAP Sync', variant: 'secondary' },
  returned_to_vendor: { label: 'Returned to Vendor', variant: 'outline' },
  returned_to_buyer: { label: 'Returned to Buyer', variant: 'outline' },
  sap_synced: { label: 'Approved (SAP Synced)', variant: 'default' },
  dms_synced: { label: 'Approved (DMS Synced)', variant: 'default' },
  sap_team_rejected: { label: 'Duplicate & Closed', variant: 'destructive' },
  sap_team_closed: { label: 'Duplicate & Closed', variant: 'destructive' },
};

function statusBadge(status: string) {
  const cfg = STATUS_LABELS[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

const displayDate = (d: Date | null) => (d ? format(d, 'dd-MM-yyyy') : '');

export default function Dashboard() {
  const { user } = useAuth();
  const { tenantIds, vendorIds } = useTenantFilter();
  const { isLoading: tenantLoading } = useTenantContext();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState<Date | null>(() => startOfDay(subDays(new Date(), 30)));
  const [dateTo, setDateTo] = useState<Date | null>(() => endOfDay(new Date()));
  const [tableSearch, setTableSearch] = useState('');


  const fromIso = dateFrom ? startOfDay(dateFrom).toISOString() : null;
  const toIso = dateTo ? endOfDay(dateTo).toISOString() : null;

  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [viewVendorId, setViewVendorId] = useState<string | null>(null);
  const [commentsVendor, setCommentsVendor] = useState<{ id: string; name: string; ref: string } | null>(null);
  const today = endOfDay(new Date());

  const handleFromSelect = (d: Date | undefined) => {
    if (!d) return;
    const start = startOfDay(d);
    setDateFrom(start);
    if (dateTo && start > dateTo) setDateTo(endOfDay(d));
    setFromOpen(false);
  };
  const handleToSelect = (d: Date | undefined) => {
    if (!d) return;
    setDateTo(endOfDay(d));
    setToOpen(false);
  };

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['dashboard-vendors', user?.id, tenantIds, vendorIds, fromIso, toIso],
    enabled: !!user?.id && !tenantLoading,
    queryFn: async (): Promise<VendorRow[]> => {
      if (vendorIds !== null && vendorIds.length === 0) return [];

      let q = supabase
        .from('vendors')
        .select('id, reference_number, legal_name, trade_name, account_holder_name, gstin, primary_email, registered_email, status, created_at, tenant_id')
        .order('created_at', { ascending: false });

      if (fromIso) q = q.gte('created_at', fromIso);
      if (toIso) q = q.lte('created_at', toIso);
      if (vendorIds && vendorIds.length > 0) q = q.in('id', vendorIds);
      if (tenantIds && tenantIds.length > 0) q = q.in('tenant_id', tenantIds);

      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as VendorRow[];

      if (rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { data: invites } = await supabase
          .from('vendor_invitations')
          .select('vendor_id, created_by, email, created_on_behalf, created_at')
          .in('vendor_id', ids)
          .order('created_at', { ascending: false });
        const latest = new Map<string, { created_by: string | null; email: string | null; on_behalf: boolean }>();
        (invites ?? []).forEach((inv: any) => {
          if (inv.vendor_id && !latest.has(inv.vendor_id)) {
            latest.set(inv.vendor_id, {
              created_by: inv.created_by,
              email: inv.email,
              on_behalf: !!inv.created_on_behalf,
            });
          }
        });
        const buyerIds = Array.from(
          new Set(Array.from(latest.values()).map((v) => v.created_by).filter(Boolean) as string[]),
        );
        const profMap = new Map<string, { name: string | null; email: string | null }>();
        if (buyerIds.length > 0) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', buyerIds);
          (profs ?? []).forEach((p: any) =>
            profMap.set(p.id, { name: p.full_name ?? null, email: p.email ?? null }),
          );
        }
        rows.forEach((r) => {
          const inv = latest.get(r.id);
          if (!inv) {
            r.invited_by = null;
            r.display_email = r.primary_email ?? r.registered_email ?? null;
            return;
          }
          const prof = inv.created_by ? profMap.get(inv.created_by) : null;
          r.invited_by = prof
            ? { name: prof.name, email: prof.email }
            : { name: null, email: inv.email };
          // On-behalf: buyer entered vendor's contact email; show it (fallback to invite email).
          // Self-signup: invitation email is the vendor's email (fallback to primary_email).
          r.display_email = inv.on_behalf
            ? (r.registered_email || inv.email || r.primary_email || null)
            : (inv.email || r.primary_email || r.registered_email || null);
        });
      }

      return rows;
    },
  });


  const counts = useMemo(() => {
    let pending = 0, approved = 0, rejected = 0, drafts = 0;
    for (const v of vendors) {
      if (DRAFT_STATUSES.has(v.status)) drafts++;
      else if (APPROVED_STATUSES.has(v.status)) approved++;
      else if (REJECTED_STATUSES.has(v.status)) rejected++;
      else if (PENDING_STATUSES.has(v.status)) pending++;
    }
    return { total: vendors.length - drafts, pending, approved, rejected };
  }, [vendors]);

  const statusFilteredVendors = useMemo(() => {
    if (statusFilter === 'all') return vendors.filter((v) => !DRAFT_STATUSES.has(v.status));
    if (statusFilter === 'approved') return vendors.filter((v) => APPROVED_STATUSES.has(v.status));
    if (statusFilter === 'rejected') return vendors.filter((v) => REJECTED_STATUSES.has(v.status));
    return vendors.filter((v) => PENDING_STATUSES.has(v.status));
  }, [vendors, statusFilter]);

  const filteredVendors = useMemo(() => {
    const q = tableSearch.toLowerCase().trim();
    if (!q) return statusFilteredVendors;
    return statusFilteredVendors.filter((v) => {
      const hay = [
        v.reference_number ?? '',
        v.invited_by?.name ?? '',
        pickVendorDisplayName(v) || '',
        v.display_email ?? '',
        STATUS_LABELS[v.status]?.label ?? v.status,
        formatDateTime(v.created_at),
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [statusFilteredVendors, tableSearch]);


  const handleExport = () => {
    const rows = filteredVendors.map((v) => ({
      'Reference Number': v.reference_number ?? '',
      'Invited By': v.invited_by ? `${v.invited_by.name ?? ''}${v.invited_by.email ? ` <${v.invited_by.email}>` : ''}`.trim() : '',
      'Vendor Name': pickVendorDisplayName(v) || '',
      'Vendor Email': v.display_email ?? '',
      'Status': STATUS_LABELS[v.status]?.label ?? v.status,
      'Created Date': formatDateTime(v.created_at),
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
    const suffix = statusFilter === 'all' ? '' : `_${statusFilter}`;
    const fname = dateFrom && dateTo
      ? `vendors_${format(dateFrom, 'yyyyMMdd')}_to_${format(dateTo, 'yyyyMMdd')}${suffix}.xlsx`
      : `vendors_all${suffix}.xlsx`;
    XLSX.writeFile(wb, fname);
  };

  const cards: Array<{
    key: StatusFilter;
    label: string;
    value: number;
    icon: typeof FileText;
    bgClass: string;
    iconBgClass: string;
    iconColorClass: string;
    ringClass: string;
  }> = [
    { key: 'all', label: 'Total Applications', value: counts.total, icon: FileText, bgClass: 'bg-blue-50', iconBgClass: 'bg-blue-100', iconColorClass: 'text-blue-600', ringClass: 'ring-2 ring-blue-500 border-blue-500' },
    { key: 'pending', label: 'Pending Applications', value: counts.pending, icon: Clock, bgClass: 'bg-orange-50', iconBgClass: 'bg-orange-100', iconColorClass: 'text-orange-600', ringClass: 'ring-2 ring-orange-500 border-orange-500' },
    { key: 'approved', label: 'Approved Applications', value: counts.approved, icon: CheckCircle, bgClass: 'bg-green-50', iconBgClass: 'bg-green-100', iconColorClass: 'text-green-600', ringClass: 'ring-2 ring-green-500 border-green-500' },
    { key: 'rejected', label: 'Rejected Applications', value: counts.rejected, icon: XCircle, bgClass: 'bg-red-50', iconBgClass: 'bg-red-100', iconColorClass: 'text-red-600', ringClass: 'ring-2 ring-red-500 border-red-500' },
  ];

  const toggleFilter = (key: StatusFilter) => {
    if (key === 'all') { setStatusFilter('all'); return; }
    setStatusFilter((cur) => (cur === key ? 'all' : key));
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[32px] font-bold tracking-tight text-foreground leading-tight">Dashboard</h1>
          <p className="text-[15px] text-muted-foreground mt-1.5">
            Vendor applications summary for the selected date range.
          </p>

        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted-foreground">From</Label>
            <Popover open={fromOpen} onOpenChange={setFromOpen}>
              <PopoverTrigger asChild>
                <div className="relative w-[170px] cursor-pointer">
                  <Input
                    readOnly
                    value={dateFrom ? displayDate(dateFrom) : ''}
                    placeholder="Select date"
                    onKeyDown={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                    className="h-9 pr-9 cursor-pointer caret-transparent"
                  />
                  <CalendarIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom ?? undefined}
                  onSelect={handleFromSelect}
                  disabled={(d) => d > today || (dateTo ? d > dateTo : false)}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs font-medium text-muted-foreground">To</Label>
            <Popover open={toOpen} onOpenChange={setToOpen}>
              <PopoverTrigger asChild>
                <div className="relative w-[170px] cursor-pointer">
                  <Input
                    readOnly
                    value={dateTo ? displayDate(dateTo) : ''}
                    placeholder="Select date"
                    onKeyDown={(e) => e.preventDefault()}
                    onPaste={(e) => e.preventDefault()}
                    className="h-9 pr-9 cursor-pointer caret-transparent"
                  />
                  <CalendarIcon className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo ?? undefined}
                  onSelect={handleToSelect}
                  disabled={(d) => (dateFrom ? d < startOfDay(dateFrom) : false)}
                  initialFocus
                  className={cn('p-3 pointer-events-auto')}
                />
              </PopoverContent>
            </Popover>
          </div>
          <Button onClick={handleExport} disabled={filteredVendors.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const active = statusFilter === c.key;
          return (
            <Card
              key={c.label}
              role="button"
              tabIndex={0}
              onClick={() => toggleFilter(c.key)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFilter(c.key); } }}
              className={cn(
                'cursor-pointer p-5 transition hover:shadow-md',
                c.bgClass,
                active && c.ringClass
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-muted-foreground truncate">
                    {c.label}
                  </p>
                  {isLoading ? (
                    <Skeleton className="mt-2 h-9 w-20" />
                  ) : (
                    <div className="mt-1.5 text-[32px] leading-none font-semibold tracking-tight text-foreground">
                      {c.value}
                    </div>
                  )}
                </div>
                <div className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0',
                  c.iconBgClass,
                  c.iconColorClass
                )}>
                  <c.icon className="h-5 w-5" />
                </div>

              </div>
            </Card>

          );
        })}
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <CardTitle className="text-base whitespace-nowrap">Vendor Applications</CardTitle>
            {statusFilter !== 'all' && (
              <div className="text-xs text-muted-foreground">
                Showing: <span className="font-medium text-foreground">{cards.find((c) => c.key === statusFilter)?.label}</span>
                <button type="button" onClick={() => setStatusFilter('all')} className="ml-2 text-primary hover:underline">Clear filter</button>
              </div>
            )}
          </div>
          <div className="w-64">
            <Input
              placeholder="Search"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="h-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference Number</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Vendor Name</TableHead>
                  <TableHead>Vendor Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredVendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      {statusFilter === 'all' ? 'No vendor applications in this date range.' : 'No vendor applications match this filter.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVendors.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-[13px] font-semibold text-foreground">
                        <Link to={`/vendors/${v.id}`} className="hover:text-primary transition-colors">
                          {v.reference_number ?? v.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {v.invited_by ? (
                          <div className="text-sm">
                            <div className="font-medium">{v.invited_by.name ?? '—'}</div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{pickVendorDisplayName(v) || '—'}</TableCell>
                      <TableCell>{v.display_email ?? '—'}</TableCell>
                      <TableCell>{statusBadge(v.status)}</TableCell>
                      <TableCell>{formatDateTime(v.created_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
