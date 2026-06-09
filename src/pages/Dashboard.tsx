import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import * as XLSX from 'xlsx';
import {
  CalendarIcon,
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

type VendorRow = {
  id: string;
  reference_number: string | null;
  legal_name: string | null;
  primary_email: string | null;
  status: string;
  created_at: string;
  tenant_id: string | null;
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

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'outline' },
  submitted: { label: 'Submitted', variant: 'secondary' },
  validation_pending: { label: 'Validating', variant: 'secondary' },
  buyer_review: { label: 'Buyer Review', variant: 'secondary' },
  scm_manager_review: { label: 'SCM Manager Review', variant: 'secondary' },
  scm_head_review: { label: 'SCM Head Review', variant: 'secondary' },
  finance_1_review: { label: 'Finance 1 Review', variant: 'secondary' },
  finance_2_review: { label: 'Finance 2 Review', variant: 'secondary' },
  ceo_office_review: { label: 'CEO Office Review', variant: 'secondary' },
  pending_sap_sync: { label: 'Pending SAP Sync', variant: 'secondary' },
  returned_to_vendor: { label: 'Returned to Vendor', variant: 'outline' },
  returned_to_buyer: { label: 'Returned to Buyer', variant: 'outline' },
  sap_synced: { label: 'Approved (SAP Synced)', variant: 'default' },
  sap_team_rejected: { label: 'SAP Team Rejected', variant: 'destructive' },
};

function statusBadge(status: string) {
  const cfg = STATUS_LABELS[status] ?? { label: status, variant: 'outline' as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { tenantIds, vendorIds } = useTenantFilter();
  const { isLoading: tenantLoading } = useTenantContext();

  const [dateFrom, setDateFrom] = useState<Date>(() => startOfDay(subDays(new Date(), 30)));
  const [dateTo, setDateTo] = useState<Date>(() => endOfDay(new Date()));

  const fromIso = startOfDay(dateFrom).toISOString();
  const toIso = endOfDay(dateTo).toISOString();

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['dashboard-vendors', user?.id, tenantIds, vendorIds, fromIso, toIso],
    enabled: !!user?.id && !tenantLoading,
    queryFn: async (): Promise<VendorRow[]> => {
      // Vendor-id scope is empty → user sees nothing.
      if (vendorIds !== null && vendorIds.length === 0) return [];

      let q = supabase
        .from('vendors')
        .select('id, reference_number, legal_name, primary_email, status, created_at, tenant_id')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: false });

      if (vendorIds && vendorIds.length > 0) q = q.in('id', vendorIds);
      else if (tenantIds && tenantIds.length > 0) q = q.in('tenant_id', tenantIds);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as VendorRow[];
    },
  });

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    for (const v of vendors) {
      if (v.status === 'sap_synced') approved++;
      else if (v.status === 'sap_team_rejected') rejected++;
      else if (PENDING_STATUSES.has(v.status)) pending++;
    }
    return { total: vendors.length, pending, approved, rejected };
  }, [vendors]);

  const handleExport = () => {
    const rows = vendors.map((v) => ({
      'Reference #': v.reference_number ?? '',
      'Company Name': v.legal_name ?? '',
      Email: v.primary_email ?? '',
      Status: STATUS_LABELS[v.status]?.label ?? v.status,
      'Created At': format(new Date(v.created_at), 'yyyy-MM-dd HH:mm'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
    const fname = `vendors_${format(dateFrom, 'yyyyMMdd')}_to_${format(dateTo, 'yyyyMMdd')}.xlsx`;
    XLSX.writeFile(wb, fname);
  };

  const cards = [
    { label: 'Total Applications', value: counts.total, icon: FileText, color: 'text-primary' },
    { label: 'Pending Applications', value: counts.pending, icon: Clock, color: 'text-amber-600' },
    { label: 'Approved Applications', value: counts.approved, icon: CheckCircle, color: 'text-emerald-600' },
    { label: 'Rejected Applications', value: counts.rejected, icon: XCircle, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Vendor applications summary for the selected date range.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DatePickerButton label="From" value={dateFrom} onChange={setDateFrom} max={dateTo} />
          <DatePickerButton label="To" value={dateTo} onChange={setDateTo} min={dateFrom} />
          <Button onClick={handleExport} disabled={vendors.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={cn('h-5 w-5', c.color)} />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-semibold">{c.value}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vendor Applications</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference #</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 5 }).map((__, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : vendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      No vendor applications in this date range.
                    </TableCell>
                  </TableRow>
                ) : (
                  vendors.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs">
                        <Link to={`/vendors/${v.id}`} className="text-primary hover:underline">
                          {v.reference_number ?? v.id.slice(0, 8)}
                        </Link>
                      </TableCell>
                      <TableCell>{v.legal_name ?? '—'}</TableCell>
                      <TableCell>{v.primary_email ?? '—'}</TableCell>
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

function DatePickerButton({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  min?: Date;
  max?: Date;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-start font-normal">
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="text-muted-foreground mr-1">{label}:</span>
          {format(value, 'dd MMM yyyy')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => d && onChange(d)}
          disabled={(d) => (min ? d < startOfDay(min) : false) || (max ? d > endOfDay(max) : false)}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
      </PopoverContent>
    </Popover>
  );
}
