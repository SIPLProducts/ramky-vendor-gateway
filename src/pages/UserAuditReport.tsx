import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VendorReviewDialog } from '@/components/vendor/VendorReviewDialog';
import { paginateItems } from '@/lib/pagination';
import { formatDate, formatDateTime } from '@/lib/dateFormat';
import { avgHours, byMonth, classifyAction, countByType, titleCase } from '@/lib/userAudit';
import { exportUserAudit } from '@/components/user-audit/exportUserAudit';
import { useToast } from '@/hooks/use-toast';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import {
  ChevronsUpDown, Check, Download, Eye, UserRound, Mail, Building2, Clock, Send, CheckCircle2, XCircle,
  RotateCcw, Hourglass, Timer, RefreshCw, Users, Search, FileSpreadsheet,
} from 'lucide-react';

type Profile = { id: string; email: string; full_name: string | null; status: string; created_at: string; last_login_attempt_at: string | null };
const STAGE_COL: Record<string, string> = {
  BUYER: 'buyer_user_id', SCM_MANAGER: 'scm_manager_user_id', SCM_HEAD: 'scm_head_user_id',
  FINANCE_1: 'finance_1_user_id', FINANCE_2: 'finance_2_user_id', CEO_OFFICE: 'ceo_office_user_id',
};
const STAGE_LABEL: Record<string, string> = {
  BUYER: 'Buyer', SCM_MANAGER: 'SCM CO', SCM_HEAD: 'SCM Head', FINANCE_1: 'Finance 1', FINANCE_2: 'Finance 2', CEO_OFFICE: 'CEO Office', SAP_TEAM: 'SAP Team',
};
const stageLabel = (s?: string | null) => (s ? STAGE_LABEL[s] ?? titleCase(s) : '—');
const vName = (v: any) => v?.trade_name || v?.legal_name || v?.pan_holder_name || 'Unnamed Vendor';
const COLORS = ['hsl(var(--success))', 'hsl(var(--destructive))', 'hsl(var(--warning))', 'hsl(var(--primary))', 'hsl(var(--muted-foreground))'];

async function chunked<T>(ids: string[], fn: (part: string[]) => Promise<T[]>) {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 150) out.push(...(await fn(ids.slice(i, i + 150))));
  return out;
}

function usePaged<T>(items: T[]) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const p = paginateItems(items, size, page);
  useEffect(() => { if (p.currentPage !== page) setPage(p.currentPage); }, [p.currentPage, page]);
  const pager = (
    <DataTablePagination currentPage={p.currentPage} totalPages={p.totalPages} pageSize={size} totalItems={items.length}
      onPageChange={setPage} onPageSizeChange={(s) => { setSize(s); setPage(1); }} />
  );
  return { rows: p.items, pager, reset: () => setPage(1) };
}

const TONES: Record<string, string> = { primary: 'bg-primary/10 text-primary', success: 'bg-success/10 text-success', destructive: 'bg-destructive/10 text-destructive', warning: 'bg-warning/10 text-warning' };

function Kpi({ icon: Icon, label, value, tone = 'primary' }: { icon: any; label: string; value: string | number; tone?: string }) {
  return (
    <Card className="rounded-[10px]">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${TONES[tone] ?? TONES.primary}`}><Icon className="h-5 w-5" /></div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UserAuditReport() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesBy, setRolesBy] = useState<Record<string, string[]>>({});
  const [tenantsBy, setTenantsBy] = useState<Record<string, string[]>>({});
  const [tenantNames, setTenantNames] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string>('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [company, setCompany] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [reviewId, setReviewId] = useState<string | null>(null);

  const [vendorsMap, setVendorsMap] = useState<Record<string, any>>({});
  const [relations, setRelations] = useState<Record<string, Set<string>>>({});
  const [invites, setInvites] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [p, r, ut, t] = await Promise.all([
        supabase.from('profiles').select('id,email,full_name,status,created_at,last_login_attempt_at').order('full_name'),
        supabase.from('user_roles').select('user_id,role'),
        supabase.from('user_tenants').select('user_id,tenant_id'),
        supabase.from('tenants').select('id,name'),
      ]);
      const roles: Record<string, string[]> = {};
      (r.data ?? []).forEach((x: any) => { (roles[x.user_id] ??= []).push(x.role); });
      const ten: Record<string, string[]> = {};
      (ut.data ?? []).forEach((x: any) => { (ten[x.user_id] ??= []).push(x.tenant_id); });
      setRolesBy(roles); setTenantsBy(ten);
      setTenantNames(Object.fromEntries((t.data ?? []).map((x: any) => [x.id, x.name])));
      setProfiles(((p.data ?? []) as Profile[]).filter((x) => !(roles[x.id] ?? []).every((ro) => ro === 'vendor') || !roles[x.id]));
    })();
  }, []);

  const load = async (uid: string) => {
    setLoading(true);
    try {
      const [inv, hist, prog, flows, logs] = await Promise.all([
        supabase.from('vendor_invitations').select('id,email,vendor_name,vendor_id,created_at,used_at,created_on_behalf,created_by,original_created_by,tenant_id').or(`created_by.eq.${uid},original_created_by.eq.${uid}`),
        supabase.from('vendor_approval_history').select('*').eq('acted_by', uid).order('acted_at', { ascending: false }),
        supabase.from('vendor_approval_progress').select('*').eq('acted_by', uid),
        supabase.from('buyer_approval_flows').select('*').or(Object.values(STAGE_COL).map((c) => `${c}.eq.${uid}`).join(',')),
        supabase.from('audit_logs').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(2000),
      ]);
      const err = inv.error || hist.error || prog.error || logs.error;
      if (err) throw err;

      // Pending queue: open progress rows at stages this user owns for a buyer's vendors
      const stagesByBuyer: Record<string, string[]> = {};
      (flows.data ?? []).forEach((f: any) => Object.entries(STAGE_COL).forEach(([st, col]) => {
        if (f[col] === uid) (stagesByBuyer[f.buyer_user_id] ??= []).push(st);
      }));
      let pend: any[] = [];
      const { data: openRows } = await supabase.from('vendor_approval_progress').select('vendor_id,stage,status,started_at,created_at').eq('status', 'pending');
      const buyers = Object.keys(stagesByBuyer);
      if ((openRows ?? []).length && buyers.length) {
        const ids = [...new Set((openRows ?? []).map((r: any) => r.vendor_id))];
        const vInv = await chunked(ids, async (part) => (await supabase.from('vendors').select('id,invitation_id,vendor_invitations!vendors_invitation_id_fkey(created_by)').in('id', part)).data ?? []);
        const buyerOf = Object.fromEntries(vInv.map((v: any) => [v.id, v.vendor_invitations?.created_by]));
        pend = (openRows ?? []).filter((r: any) => (stagesByBuyer[buyerOf[r.vendor_id]] ?? []).includes(r.stage));
      }

      const rel: Record<string, Set<string>> = {};
      const add = (id: string | null, label: string) => { if (id) (rel[id] ??= new Set()).add(label); };
      (inv.data ?? []).forEach((i: any) => add(i.vendor_id, i.created_by === uid ? (i.created_on_behalf ? 'Created On Behalf' : 'Invited') : 'Originally Invited'));
      (hist.data ?? []).forEach((h: any) => add(h.vendor_id, 'Approver'));
      (prog.data ?? []).forEach((h: any) => add(h.vendor_id, 'Approver'));
      pend.forEach((h: any) => add(h.vendor_id, 'Pending With User'));
      (logs.data ?? []).forEach((l: any) => add(l.vendor_id, 'Activity'));
      const ids = Object.keys(rel);
      const vs = await chunked(ids, async (part) => (await supabase.from('vendors').select('*').in('id', part)).data ?? []);
      setVendorsMap(Object.fromEntries(vs.map((v: any) => [v.id, v])));
      setRelations(rel); setInvites(inv.data ?? []); setHistory(hist.data ?? []); setProgress(prog.data ?? []);
      setPending(pend); setActivity(logs.data ?? []);
    } catch (e: any) {
      toast({ title: 'Could Not Load Report', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { if (userId) load(userId); }, [userId]);

  const user = profiles.find((p) => p.id === userId);
  const inRange = (d?: string | null) => {
    if (!d) return !from && !to;
    const t = new Date(d).getTime();
    if (from && t < new Date(from).getTime()) return false;
    if (to && t > new Date(to).getTime() + 864e5 - 1) return false;
    return true;
  };
  const vendorOk = (v: any) => !!v && (company === 'all' || v.tenant_id === company) && (status === 'all' || v.status === status);
  const q = search.trim().toLowerCase();
  const matchQ = (...xs: any[]) => !q || xs.some((x) => String(x ?? '').toLowerCase().includes(q));

  const vendorRows = useMemo(() => Object.entries(relations)
    .map(([id, r]) => ({ vendor: vendorsMap[id], relation: [...r].join(', '), invite: invites.find((i) => i.vendor_id === id) }))
    .filter((x) => vendorOk(x.vendor) && inRange(x.invite?.created_at ?? x.vendor.created_at)
      && matchQ(vName(x.vendor), x.vendor.reference_number, x.vendor.gstin, x.vendor.pan, x.vendor.sap_vendor_code))
    .sort((a, b) => (b.vendor.created_at ?? '').localeCompare(a.vendor.created_at ?? '')),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [relations, vendorsMap, invites, company, status, from, to, q]);

  const progByKey = useMemo(() => Object.fromEntries(progress.map((p) => [`${p.vendor_id}|${p.stage}`, p])), [progress]);
  const actionRows = useMemo(() => history
    .filter((h) => inRange(h.acted_at) && (company === 'all' && status === 'all' ? true : vendorOk(vendorsMap[h.vendor_id])))
    .map((h) => ({ ...h, started_at: progByKey[`${h.vendor_id}|${h.stage}`]?.started_at ?? null, vendor: vendorsMap[h.vendor_id] }))
    .filter((h) => matchQ(vName(h.vendor), h.vendor?.reference_number, h.comments, h.action)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [history, progByKey, vendorsMap, company, status, from, to, q]);

  const pendingRows = useMemo(() => pending.map((p) => ({ ...p, vendor: vendorsMap[p.vendor_id] }))
    .filter((p) => vendorOk(p.vendor) && matchQ(vName(p.vendor), p.vendor?.reference_number)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [pending, vendorsMap, company, status, q]);

  const activityRows = useMemo(() => activity.filter((a) => inRange(a.created_at) && matchQ(a.action, JSON.stringify(a.details ?? {}))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [activity, from, to, q]);

  const types = countByType(actionRows);
  const invitedCount = invites.filter((i) => i.created_by === userId && !i.created_on_behalf && inRange(i.created_at)).length;
  const behalfCount = invites.filter((i) => i.created_by === userId && i.created_on_behalf && inRange(i.created_at)).length;
  const avg = avgHours(actionRows);
  const sapSynced = vendorRows.filter((r) => !!r.vendor.sap_vendor_code).length;

  const timeline = useMemo(() => {
    const a = byMonth(actionRows.map((h) => h.acted_at));
    const i = byMonth(invites.filter((x) => x.created_by === userId && inRange(x.created_at)).map((x) => x.created_at));
    const keys = [...new Set([...a, ...i].map((x) => x.month))].sort((x, y) => x.slice(3).localeCompare(y.slice(3)) || x.localeCompare(y));
    return keys.map((m) => ({ month: m, Actions: a.find((x) => x.month === m)?.count ?? 0, Invitations: i.find((x) => x.month === m)?.count ?? 0 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionRows, invites, userId, from, to]);
  const typeData = [
    { name: 'Approved', value: types.Approved }, { name: 'Rejected', value: types.Rejected },
    { name: 'Returned', value: types.Returned }, { name: 'Invited', value: invitedCount + behalfCount },
  ].filter((x) => x.value > 0);
  const statusData = Object.entries(vendorRows.reduce<Record<string, number>>((m, r) => { const k = titleCase(r.vendor.status); m[k] = (m[k] || 0) + 1; return m; }, {}))
    .map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const stageData = Object.keys(STAGE_LABEL).map((s) => {
    const rows = actionRows.filter((h) => h.stage === s);
    const c = countByType(rows);
    return { stage: STAGE_LABEL[s], Approved: c.Approved, Rejected: c.Rejected, Returned: c.Returned };
  }).filter((x) => x.Approved + x.Rejected + x.Returned > 0);

  const vPage = usePaged(vendorRows), aPage = usePaged(actionRows), pPage = usePaged(pendingRows), lPage = usePaged(activityRows);
  useEffect(() => { vPage.reset(); aPage.reset(); pPage.reset(); lPage.reset(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, from, to, company, status, q]);

  const hoursSince = (d?: string) => (d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 36e5)) : null);
  const fmtWait = (h: number | null) => (h == null ? '—' : h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`);
  const roles = (rolesBy[userId] ?? []).map(titleCase).join(', ') || '—';
  const companies = (tenantsBy[userId] ?? []).map((t) => tenantNames[t]).filter(Boolean).join(', ') || 'All Companies';
  const statuses = [...new Set(Object.values(vendorsMap).map((v: any) => v.status))].sort();

  const doExport = () => {
    if (!user) return;
    exportUserAudit({
      userName: user.full_name || user.email,
      summary: {
        'User Name': user.full_name ?? '', Email: user.email, Roles: roles, Companies: companies, Status: titleCase(user.status),
        'Date Range': from || to ? `${from ? formatDate(from) : 'Start'} to ${to ? formatDate(to) : 'Today'}` : 'All Time',
        'Vendors Linked': vendorRows.length, 'Vendors Invited': invitedCount, 'Created On Behalf': behalfCount,
        Approvals: types.Approved, Rejections: types.Rejected, 'Returns / Clarifications': types.Returned,
        'Pending In Queue': pendingRows.length, 'Average Approval Time (Hours)': avg ?? '—', 'SAP Synced Vendors': sapSynced,
        'Generated On': formatDateTime(new Date()),
      },
      vendors: vendorRows.map((r) => ({ vendor: { ...r.vendor, company: tenantNames[r.vendor.tenant_id] ?? '' }, relation: r.relation })),
      actions: actionRows.map((h) => ({
        'Date / Time': formatDateTime(h.acted_at), 'Reference No': h.vendor?.reference_number ?? '', Vendor: vName(h.vendor),
        Stage: stageLabel(h.stage), Action: classifyAction(h.action) === 'Other' ? titleCase(h.action) : classifyAction(h.action),
        Comments: h.comments ?? '', 'Time Taken (Hours)': h.started_at ? Math.round((new Date(h.acted_at).getTime() - new Date(h.started_at).getTime()) / 36e5 * 10) / 10 : '',
      })),
      pending: pendingRows.map((p) => ({
        'Reference No': p.vendor?.reference_number ?? '', Vendor: vName(p.vendor), Stage: stageLabel(p.stage),
        'Waiting Since': formatDateTime(p.started_at ?? p.created_at), 'Waiting For': fmtWait(hoursSince(p.started_at ?? p.created_at)),
      })),
      activity: activityRows.map((a) => ({
        'Date / Time': formatDateTime(a.created_at), Action: titleCase(a.action), Vendor: vName(vendorsMap[a.vendor_id]) === 'Unnamed Vendor' ? '' : vName(vendorsMap[a.vendor_id]),
        Details: JSON.stringify(a.details ?? {}), 'IP Address': a.ip_address ?? '',
      })),
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2"><FileSpreadsheet className="h-6 w-6 text-primary" />User Audit Report</h1>
          <p className="text-sm text-muted-foreground">Select A User To See Every Vendor, Approval And Action Linked To Them.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!userId || loading} onClick={() => load(userId)}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          <Button disabled={!user || loading} onClick={doExport}><Download className="h-4 w-4 mr-2" />Export To Excel</Button>
        </div>
      </div>

      <Card className="rounded-[10px]">
        <CardContent className="p-4 grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">User</p>
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className="truncate">{user ? `${user.full_name || user.email}` : 'Select A User'}</span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search Name Or Email..." />
                  <CommandList>
                    <CommandEmpty>No Users Found.</CommandEmpty>
                    <CommandGroup>
                      {profiles.map((p) => (
                        <CommandItem key={p.id} value={`${p.full_name ?? ''} ${p.email}`} onSelect={() => { setUserId(p.id); setPickerOpen(false); }}>
                          <Check className={`h-4 w-4 mr-2 ${p.id === userId ? 'opacity-100' : 'opacity-0'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm truncate">{p.full_name || p.email}</p>
                            <p className="text-xs text-muted-foreground truncate">{p.email} · {(rolesBy[p.id] ?? []).map(titleCase).join(', ')}</p>
                          </div>
                          {p.status !== 'active' && <Badge variant="secondary" className="ml-2">Inactive</Badge>}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div><p className="text-xs font-medium text-muted-foreground mb-1">From</p><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><p className="text-xs font-medium text-muted-foreground mb-1">To</p><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Company</p>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Companies</SelectItem>
                {Object.entries(tenantNames).map(([id, n]) => <SelectItem key={id} value={id}>{n}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Vendor Status</p>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">All Statuses</SelectItem>
                {statuses.map((s) => <SelectItem key={s} value={s}>{titleCase(s)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!userId ? (
        <Card className="rounded-[10px]"><CardContent className="py-16 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />Select A User Above To View Their Audit Report.
        </CardContent></Card>
      ) : loading ? (
        <div className="space-y-4"><Skeleton className="h-24 w-full" /><div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div><Skeleton className="h-72 w-full" /></div>
      ) : (
        <>
          <Card className="rounded-[10px] border-l-4 border-l-primary">
            <CardContent className="p-4 flex flex-wrap items-center gap-x-8 gap-y-2">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center"><UserRound className="h-6 w-6" /></div>
                <div><p className="font-semibold text-foreground">{user?.full_name || user?.email}</p>
                  <Badge variant={user?.status === 'active' ? 'default' : 'secondary'}>{titleCase(user?.status ?? '')}</Badge></div>
              </div>
              <div className="text-sm"><p className="text-muted-foreground text-xs flex items-center gap-1"><Mail className="h-3 w-3" />Email</p>{user?.email}</div>
              <div className="text-sm"><p className="text-muted-foreground text-xs">Roles</p>{roles}</div>
              <div className="text-sm"><p className="text-muted-foreground text-xs flex items-center gap-1"><Building2 className="h-3 w-3" />Companies</p>{companies}</div>
              <div className="text-sm"><p className="text-muted-foreground text-xs flex items-center gap-1"><Clock className="h-3 w-3" />Last Login</p>{formatDateTime(user?.last_login_attempt_at, '—')}</div>
              <div className="text-sm"><p className="text-muted-foreground text-xs">User Since</p>{formatDate(user?.created_at, '—')}</div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Kpi icon={Send} label="Vendors Invited" value={invitedCount} />
            <Kpi icon={Users} label="Created On Behalf" value={behalfCount} />
            <Kpi icon={CheckCircle2} label="Approvals" value={types.Approved} tone="success" />
            <Kpi icon={XCircle} label="Rejections" value={types.Rejected} tone="destructive" />
            <Kpi icon={RotateCcw} label="Returns / Clarifications" value={types.Returned} tone="warning" />
            <Kpi icon={Hourglass} label="Pending In Queue" value={pendingRows.length} tone="warning" />
            <Kpi icon={Timer} label="Avg Approval Time" value={avg == null ? '—' : `${avg} h`} />
            <Kpi icon={RefreshCw} label="SAP Synced Vendors" value={sapSynced} tone="success" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="rounded-[10px]"><CardHeader className="pb-2"><CardTitle className="text-base">Activity Over Time</CardTitle></CardHeader>
              <CardContent className="h-64">{timeline.length ? (
                <ResponsiveContainer><LineChart data={timeline}><CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip /><Legend />
                  <Line type="monotone" dataKey="Actions" stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Line type="monotone" dataKey="Invitations" stroke="hsl(var(--success))" strokeWidth={2} /></LineChart></ResponsiveContainer>
              ) : <Empty />}</CardContent></Card>
            <Card className="rounded-[10px]"><CardHeader className="pb-2"><CardTitle className="text-base">Actions By Type</CardTitle></CardHeader>
              <CardContent className="h-64">{typeData.length ? (
                <ResponsiveContainer><PieChart><Pie data={typeData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} label>
                  {typeData.map((d, i) => <Cell key={d.name} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
              ) : <Empty />}</CardContent></Card>
            <Card className="rounded-[10px]"><CardHeader className="pb-2"><CardTitle className="text-base">Vendors By Current Status</CardTitle></CardHeader>
              <CardContent className="h-64">{statusData.length ? (
                <ResponsiveContainer><BarChart data={statusData} layout="vertical" margin={{ left: 40 }}><CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" allowDecimals={false} fontSize={12} /><YAxis type="category" dataKey="name" width={130} fontSize={11} /><Tooltip />
                  <Bar dataKey="count" name="Vendors" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
              ) : <Empty />}</CardContent></Card>
            <Card className="rounded-[10px]"><CardHeader className="pb-2"><CardTitle className="text-base">Actions By Approval Stage</CardTitle></CardHeader>
              <CardContent className="h-64">{stageData.length ? (
                <ResponsiveContainer><BarChart data={stageData}><CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="stage" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} /><Tooltip /><Legend />
                  <Bar dataKey="Approved" stackId="a" fill="hsl(var(--success))" /><Bar dataKey="Rejected" stackId="a" fill="hsl(var(--destructive))" />
                  <Bar dataKey="Returned" stackId="a" fill="hsl(var(--warning))" /></BarChart></ResponsiveContainer>
              ) : <Empty />}</CardContent></Card>
          </div>

          <Card className="rounded-[10px]">
            <CardContent className="p-4">
              <Tabs defaultValue="vendors">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <TabsList>
                    <TabsTrigger value="vendors">Vendors ({vendorRows.length})</TabsTrigger>
                    <TabsTrigger value="actions">Approval Actions ({actionRows.length})</TabsTrigger>
                    <TabsTrigger value="pending">Pending Queue ({pendingRows.length})</TabsTrigger>
                    <TabsTrigger value="activity">Activity Log ({activityRows.length})</TabsTrigger>
                  </TabsList>
                  <div className="relative w-full sm:w-72"><Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search Vendor, Reference, GSTIN..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                </div>

                <TabsContent value="vendors">
                  <div className="overflow-x-auto"><Table><TableHeader><TableRow>
                    <TableHead>Reference No</TableHead><TableHead>Vendor Name</TableHead><TableHead>GSTIN</TableHead><TableHead>PAN</TableHead>
                    <TableHead>Company</TableHead><TableHead>Current Status</TableHead><TableHead>SAP Code</TableHead><TableHead>Invited On</TableHead>
                    <TableHead>Submitted On</TableHead><TableHead>User Relation</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>{vPage.rows.length ? vPage.rows.map(({ vendor: v, relation, invite }) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">{v.reference_number ?? '—'}</TableCell>
                        <TableCell className="font-medium">{vName(v)}</TableCell>
                        <TableCell className="font-mono text-xs">{v.gstin ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs">{v.pan ?? '—'}</TableCell>
                        <TableCell>{tenantNames[v.tenant_id] ?? '—'}</TableCell>
                        <TableCell><Badge variant="outline">{titleCase(v.status)}</Badge></TableCell>
                        <TableCell>{v.sap_vendor_code ?? '—'}</TableCell>
                        <TableCell>{formatDate(invite?.created_at, '—')}</TableCell>
                        <TableCell>{formatDate(v.submitted_at, '—')}</TableCell>
                        <TableCell className="text-xs">{relation}</TableCell>
                        <TableCell><Button size="sm" variant="ghost" onClick={() => setReviewId(v.id)}><Eye className="h-4 w-4 mr-1" />View</Button></TableCell>
                      </TableRow>)) : <EmptyRow cols={11} />}</TableBody></Table></div>{vPage.pager}
                </TabsContent>

                <TabsContent value="actions">
                  <div className="overflow-x-auto"><Table><TableHeader><TableRow>
                    <TableHead>Date / Time</TableHead><TableHead>Reference No</TableHead><TableHead>Vendor</TableHead><TableHead>Stage</TableHead>
                    <TableHead>Action</TableHead><TableHead>Comments</TableHead><TableHead>Time Taken</TableHead></TableRow></TableHeader>
                    <TableBody>{aPage.rows.length ? aPage.rows.map((h) => {
                      const t = classifyAction(h.action);
                      const hrs = h.started_at ? Math.max(0, Math.round((new Date(h.acted_at).getTime() - new Date(h.started_at).getTime()) / 36e5)) : null;
                      return (<TableRow key={h.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(h.acted_at)}</TableCell>
                        <TableCell className="font-mono text-xs">{h.vendor?.reference_number ?? '—'}</TableCell>
                        <TableCell className="font-medium">{vName(h.vendor)}</TableCell>
                        <TableCell>{stageLabel(h.stage)}</TableCell>
                        <TableCell><Badge variant={t === 'Rejected' ? 'destructive' : 'outline'} className={t === 'Approved' ? 'bg-success/10 text-success' : t === 'Returned' ? 'bg-warning/10 text-warning' : ''}>{t === 'Other' ? titleCase(h.action) : t}</Badge></TableCell>
                        <TableCell className="max-w-xs text-sm">{h.comments || '—'}</TableCell>
                        <TableCell>{fmtWait(hrs)}</TableCell>
                      </TableRow>);
                    }) : <EmptyRow cols={7} />}</TableBody></Table></div>{aPage.pager}
                </TabsContent>

                <TabsContent value="pending">
                  <div className="overflow-x-auto"><Table><TableHeader><TableRow>
                    <TableHead>Reference No</TableHead><TableHead>Vendor</TableHead><TableHead>Stage</TableHead><TableHead>Waiting Since</TableHead><TableHead>Waiting For</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>{pPage.rows.length ? pPage.rows.map((p) => (
                      <TableRow key={`${p.vendor_id}-${p.stage}`}>
                        <TableCell className="font-mono text-xs">{p.vendor?.reference_number ?? '—'}</TableCell>
                        <TableCell className="font-medium">{vName(p.vendor)}</TableCell>
                        <TableCell>{stageLabel(p.stage)}</TableCell>
                        <TableCell>{formatDateTime(p.started_at ?? p.created_at, '—')}</TableCell>
                        <TableCell><Badge variant="outline" className="bg-warning/10 text-warning">{fmtWait(hoursSince(p.started_at ?? p.created_at))}</Badge></TableCell>
                        <TableCell><Button size="sm" variant="ghost" onClick={() => setReviewId(p.vendor_id)}><Eye className="h-4 w-4 mr-1" />View</Button></TableCell>
                      </TableRow>)) : <EmptyRow cols={6} />}</TableBody></Table></div>{pPage.pager}
                </TabsContent>

                <TabsContent value="activity">
                  <div className="overflow-x-auto"><Table><TableHeader><TableRow>
                    <TableHead>Date / Time</TableHead><TableHead>Action</TableHead><TableHead>Vendor</TableHead><TableHead>Details</TableHead><TableHead>IP Address</TableHead></TableRow></TableHeader>
                    <TableBody>{lPage.rows.length ? lPage.rows.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(a.created_at)}</TableCell>
                        <TableCell><Badge variant="outline">{titleCase(a.action)}</Badge></TableCell>
                        <TableCell>{a.vendor_id && vendorsMap[a.vendor_id] ? vName(vendorsMap[a.vendor_id]) : '—'}</TableCell>
                        <TableCell className="max-w-md text-xs text-muted-foreground truncate" title={JSON.stringify(a.details ?? {})}>{JSON.stringify(a.details ?? {})}</TableCell>
                        <TableCell className="text-xs">{a.ip_address ?? '—'}</TableCell>
                      </TableRow>)) : <EmptyRow cols={5} />}</TableBody></Table></div>{lPage.pager}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
      <VendorReviewDialog vendorId={reviewId} open={!!reviewId} onOpenChange={(o) => !o && setReviewId(null)} />
    </div>
  );
}

function Empty() { return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No Data For This Selection</div>; }
function EmptyRow({ cols }: { cols: number }) { return <TableRow><TableCell colSpan={cols} className="text-center py-8 text-muted-foreground">No Records Found</TableCell></TableRow>; }
