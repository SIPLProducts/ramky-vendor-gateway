import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import * as XLSX from 'xlsx';
import {
  CheckCircle,
  Clock,
  Download,
  FileText,
  XCircle,
} from 'lucide-react';

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
import { getSapName1 } from '@/lib/sapPayloadBuilder';

type VendorRow = {
  id: string;
  reference_number: string | null;
  legal_name: string | null;
  trade_name: string | null;
  gstin: string | null;
  primary_email: string | null;
  status: string;
  created_at: string;
  tenant_id: string | null;
  invited_by?: { name: string | null; email: string | null } | null;
};


const PENDING_STATUSES = new Set([
  'draft',
  'submitted',
  'validation_pending',
  'buyer_review',
  'scm_manager_review',
  'scm_head_review',
  'finance_1_review',
  'finance_2_review',
  'ceo_office_review',
  'pending_sap_sync',
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

const toInputValue = (d: Date | null) => (d ? format(d, 'yyyy-MM-dd') : '');

export default function Dashboard() {
  const { user } = useAuth();
  const { tenantIds, vendorIds } = useTenantFilter();
  const { isLoading: tenantLoading } = useTenantContext();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFrom, setDateFrom] = useState<Date | null>(() => startOfDay(subDays(new Date(), 30)));
  const [dateTo, setDateTo] = useState<Date | null>(() => endOfDay(new Date()));

  const fromIso = dateFrom ? startOfDay(dateFrom).toISOString() : null;
  const toIso = dateTo ? endOfDay(dateTo).toISOString() : null;

  const handleFromChange = (val: string) => {
    if (!val) { setDateFrom(null); return; }
    const d = startOfDay(new Date(val));
    setDateFrom(d);
    if (dateTo && d > dateTo) setDateTo(endOfDay(d));
  };
  const handleToChange = (val: string) => {
    if (!val) { setDateTo(null); return; }
    const d = endOfDay(new Date(val));
    setDateTo(d);
    if (dateFrom && d < dateFrom) setDateFrom(startOfDay(new Date(val)));
  };

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['dashboard-vendors', user?.id, tenantIds, vendorIds, fromIso, toIso],
    enabled: !!user?.id && !tenantLoading,
    queryFn: async (): Promise<VendorRow[]> => {
      if (vendorIds !== null && vendorIds.length === 0) return [];

      let q = supabase
        .from('vendors')
        .select('id, reference_number, legal_name, trade_name, gstin, primary_email, status, created_at, tenant_id')
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
          .select('vendor_id, created_by, email, created_at')
          .in('vendor_id', ids)
          .order('created_at', { ascending: false });
        const latest = new Map<string, { created_by: string | null; email: string | null }>();
        (invites ?? []).forEach((inv: any) => {
          if (inv.vendor_id && !latest.has(inv.vendor_id)) {
            latest.set(inv.vendor_id, { created_by: inv.created_by, email: inv.email });
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
          if (!inv) { r.invited_by = null; return; }
          const prof = inv.created_by ? profMap.get(inv.created_by) : null;
          r.invited_by = prof
            ? { name: prof.name, email: prof.email }
            : { name: null, email: inv.email };
        });
      }

      return rows;
    },
  });


  const counts = useMemo(() => {
    let pending = 0, approved = 0, rejected = 0;
    for (const v of vendors) {
      if (APPROVED_STATUSES.has(v.status)) approved++;
      else if (REJECTED_STATUSES.has(v.status)) rejected++;
      else if (PENDING_STATUSES.has(v.status)) pending++;
    }
    return { total: vendors.length, pending, approved, rejected };
  }, [vendors]);

  const filteredVendors = useMemo(() => {
    if (statusFilter === 'all') return vendors;
    if (statusFilter === 'approved') return vendors.filter((v) => APPROVED_STATUSES.has(v.status));
    if (statusFilter === 'rejected') return vendors.filter((v) => REJECTED_STATUSES.has(v.status));
    return vendors.filter((v) => PENDING_STATUSES.has(v.status));
  }, [vendors, statusFilter]);

  const handleExport = () => {
    const rows = filteredVendors.map((v) => ({
      'Reference #': v.reference_number ?? '',
      'Company Name': v.legal_name ?? '',
      'Invited By': v.invited_by ? `${v.invited_by.name ?? ''}${v.invited_by.email ? ` <${v.invited_by.email}>` : ''}`.trim() : '',
      Email: v.primary_email ?? v.invited_by?.email ?? '',
      Status: STATUS_LABELS[v.status]?.label ?? v.status,
      'Created Date': format(new Date(v.created_at), 'yyyy-MM-dd HH:mm'),
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

  const cards: Array<{ key: StatusFilter; label: string; value: number; icon: typeof FileText; color: string }> = [
    { key: 'all', label: 'Total Applications', value: counts.total, icon: FileText, color: 'text-primary' },
    { key: 'pending', label: 'Pending Applications', value: counts.pending, icon: Clock, color: 'text-amber-600' },
    { key: 'approved', label: 'Approved Applications', value: counts.approved, icon: CheckCircle, color: 'text-emerald-600' },
    { key: 'rejected', label: 'Rejected Applications', value: counts.rejected, icon: XCircle, color: 'text-destructive' },
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
            <Label htmlFor="from" className="text-xs font-medium text-muted-foreground">From</Label>
            <Input
              id="from"
              type="date"
              value={toInputValue(dateFrom)}
              onChange={(e) => handleFromChange(e.target.value)}
              className="h-9 w-[160px]"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="to" className="text-xs font-medium text-muted-foreground">To</Label>

            <Input
              id="to"
              type="date"
              value={toInputValue(dateTo)}
              onChange={(e) => handleToChange(e.target.value)}
              className="h-9 w-[160px]"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => { setDateFrom(null); setDateTo(null); }}
          >
            Clear
          </Button>
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
                active && 'ring-1 ring-primary border-primary'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
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
                  'flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0',
                  c.color
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
          <CardTitle className="text-base">Vendor Applications</CardTitle>
          {statusFilter !== 'all' && (
            <div className="text-xs text-muted-foreground">
              Showing: <span className="font-medium text-foreground">{cards.find((c) => c.key === statusFilter)?.label}</span>
              <button type="button" onClick={() => setStatusFilter('all')} className="ml-2 text-primary hover:underline">Clear filter</button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference #</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Email</TableHead>
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

                      <TableCell>{getSapName1(v) || v.legal_name || '—'}</TableCell>
                      <TableCell>
                        {v.invited_by ? (
                          <div className="text-sm">
                            <div className="font-medium">{v.invited_by.name ?? v.invited_by.email ?? '—'}</div>
                            {v.invited_by.name && v.invited_by.email && (
                              <div className="text-xs text-muted-foreground">{v.invited_by.email}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>{v.primary_email ?? v.invited_by?.email ?? '—'}</TableCell>
                      <TableCell>{statusBadge(v.status)}</TableCell>
                      <TableCell>{format(new Date(v.created_at), 'dd MMM yyyy, HH:mm')}</TableCell>
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
