import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTablePagination } from '@/components/ui/data-table-pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VendorReviewDialog } from '@/components/vendor/VendorReviewDialog';
import { paginateItems } from '@/lib/pagination';
import { formatDate, formatDateTime } from '@/lib/dateFormat';
import { avgHours, byMonth, classifyAction, countByType, titleCase } from '@/lib/userAudit';
import { exportUserAudit } from '@/components/user-audit/exportUserAudit';
import { exportUserAuditPdf } from '@/components/user-audit/exportUserAuditPdf';
import { useToast } from '@/hooks/use-toast';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, Legend, LabelList,
} from 'recharts';
import {
  ChevronsUpDown, Check, Download, Eye, UserRound, Mail, Building2, Clock, Send, CheckCircle2, XCircle,
  RotateCcw, Hourglass, Timer, RefreshCw, Users, Search, FileSpreadsheet, FileText,
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
const COLORS = ['url(#gS)', 'url(#gD)', 'url(#gW)', 'url(#gP)', 'url(#gM)'];

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

const TONES: Record<string, { card: string; icon: string; text: string }> = {
  primary: { card: 'from-primary/15 via-primary/5 to-card border-primary/20', icon: 'bg-gradient-to-br from-primary to-primary/70', text: 'text-primary' },
  success: { card: 'from-success/15 via-success/5 to-card border-success/20', icon: 'bg-gradient-to-br from-success to-success/70', text: 'text-success' },
  destructive: { card: 'from-destructive/15 via-destructive/5 to-card border-destructive/20', icon: 'bg-gradient-to-br from-destructive to-destructive/70', text: 'text-destructive' },
  warning: { card: 'from-warning/20 via-warning/5 to-card border-warning/25', icon: 'bg-gradient-to-br from-warning to-warning/70', text: 'text-warning' },
  accent: { card: 'from-success/10 via-primary/5 to-card border-primary/20', icon: 'bg-gradient-to-br from-primary/80 to-success/80', text: 'text-primary' },
};
const STATUS_ROW = (st?: string, pending?: boolean) => pending ? 'bg-warning/10 border-l-4 border-l-warning hover:bg-warning/15'
  : /reject/i.test(st ?? '') ? 'bg-destructive/5 border-l-4 border-l-destructive/60'
  : /approved|sap_synced|dms_synced|active|completed/i.test(st ?? '') ? 'bg-success/5 border-l-4 border-l-success/60' : 'border-l-4 border-l-transparent';
const STATUS_BADGE = (st?: string) => /reject/i.test(st ?? '') ? 'bg-destructive/10 text-destructive border-destructive/30'
  : /approved|synced|active|completed/i.test(st ?? '') ? 'bg-success/10 text-success border-success/30'
  : /pending|review|submitted/i.test(st ?? '') ? 'bg-warning/10 text-warning border-warning/30' : 'bg-primary/10 text-primary border-primary/30';
const TH = '!h-auto !py-1.5 !px-2 !text-[10px] leading-tight whitespace-nowrap font-semibold uppercase tracking-wide text-primary';
const TD = '!px-2 !py-1 !text-[11px] leading-tight whitespace-nowrap';
const TYPE_ORDER = ['Pending', 'Approved', 'Rejected', 'Returned', 'Invited', 'On Behalf', 'Activity'] as const;
const TYPE_LABEL: Record<string, string> = { Pending: 'Pending With User', Returned: 'Returned For Clarification', 'On Behalf': 'Created On Behalf' };
type RowType = typeof TYPE_ORDER[number];
const TYPE_STYLE: Record<RowType, { pill: string; row: string; chip: string; chipOn: string }> = {
  Pending: { pill: 'bg-gradient-to-r from-warning to-warning/70 text-warning-foreground', row: 'border-l-warning bg-warning/10 font-medium', chip: 'border-warning/40 text-warning bg-warning/5', chipOn: 'bg-warning text-warning-foreground border-warning' },
  Approved: { pill: 'bg-success/15 text-success', row: 'border-l-success bg-success/5', chip: 'border-success/40 text-success bg-success/5', chipOn: 'bg-success text-success-foreground border-success' },
  Rejected: { pill: 'bg-destructive/15 text-destructive', row: 'border-l-destructive bg-destructive/5', chip: 'border-destructive/40 text-destructive bg-destructive/5', chipOn: 'bg-destructive text-destructive-foreground border-destructive' },
  Returned: { pill: 'bg-warning/15 text-warning', row: 'border-l-warning/60 bg-warning/5', chip: 'border-warning/40 text-warning bg-warning/5', chipOn: 'bg-warning text-warning-foreground border-warning' },
  Invited: { pill: 'bg-primary/15 text-primary', row: 'border-l-primary bg-primary/5', chip: 'border-primary/40 text-primary bg-primary/5', chipOn: 'bg-primary text-primary-foreground border-primary' },
  'On Behalf': { pill: 'bg-gradient-to-r from-primary/25 to-success/20 text-primary', row: 'border-l-primary/60 bg-primary/5', chip: 'border-primary/40 text-primary bg-primary/5', chipOn: 'bg-primary text-primary-foreground border-primary' },
  Activity: { pill: 'bg-muted text-muted-foreground', row: 'border-l-muted-foreground/30', chip: 'border-border text-muted-foreground', chipOn: 'bg-muted-foreground text-background border-muted-foreground' },
};

function Kpi({ icon: Icon, label, value, tone = 'primary' }: { icon: any; label: string; value: string | number; tone?: string }) {
  return (
    <Card className={`rounded-[10px] bg-gradient-to-br shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${(TONES[tone] ?? TONES.primary).card}`}>
      <CardContent className="!p-2 flex items-center gap-2">
        <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-primary-foreground shadow-sm ${(TONES[tone] ?? TONES.primary).icon}`}><Icon className="h-4 w-4" /></div>
        <div className="min-w-0">
          <p className="!text-[10px] leading-tight text-muted-foreground line-clamp-2">{label}</p>
          <p className={`!text-base leading-tight font-bold ${(TONES[tone] ?? TONES.primary).text}`}>{value}</p>
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
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [pickerOpen]);
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
  const [vInvites, setVInvites] = useState<Record<string, any>>({});

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
      const invIds = [...new Set(vs.map((v: any) => v.invitation_id).filter(Boolean))] as string[];
      const vi = await chunked(invIds, async (part) => (await supabase.from('vendor_invitations').select('id,vendor_id,created_by,original_created_by,created_on_behalf,created_at').in('id', part)).data ?? []);
      const byInv = Object.fromEntries(vi.map((i: any) => [i.id, i]));
      setVInvites(Object.fromEntries(vs.map((v: any) => [v.id, byInv[v.invitation_id] ?? (inv.data ?? []).find((i: any) => i.vendor_id === v.id)]).filter(([, i]) => i)));
      setRelations(rel); setInvites(inv.data ?? []); setHistory(hist.data ?? []); setProgress(prog.data ?? []);
      setPending(pend); setActivity(logs.data ?? []);
    } catch (e: any) {
      toast({ title: 'Could Not Load Report', description: e?.message ?? 'Please try again.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  useEffect(() => { if (userId) load(userId); }, [userId]);

  const user = profiles.find((p) => p.id === userId);
  const pName = (id?: string | null) => { const p = profiles.find((x) => x.id === id); return p ? (p.full_name || p.email) : '—'; };
  const pendingIds = useMemo(() => new Set(pending.map((p) => p.vendor_id)), [pending]);
  const invitedBy = (vid?: string) => { const i = vInvites[vid ?? '']; if (!i) return { name: '—', behalf: false };
    return { name: i.created_by === userId ? 'Self' : pName(i.created_by), behalf: !!i.created_on_behalf }; };
  const invitedByText = (vid?: string) => { const b = invitedBy(vid); return b.behalf ? `${b.name} (On Behalf)` : b.name; };
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
    .map(([id, r]) => ({ vendor: vendorsMap[id], relation: [...r].join(', '), invite: invites.find((i) => i.vendor_id === id) ?? vInvites[id] }))
    .filter((x) => vendorOk(x.vendor) && inRange(x.invite?.created_at ?? x.vendor.created_at)
      && matchQ(vName(x.vendor), x.vendor.reference_number, x.vendor.gstin, x.vendor.pan, x.vendor.sap_vendor_code))
    .sort((a, b) => (b.vendor.created_at ?? '').localeCompare(a.vendor.created_at ?? '')),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [relations, vendorsMap, invites, vInvites, company, status, from, to, q]);

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

  const hoursSince = (d?: string) => (d ? Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 36e5)) : null);
  const fmtWait = (h: number | null) => (h == null ? '—' : h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h`);
  const hrs2 = (a?: string, b?: string) => (a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 36e5)) : null);
  const combined = useMemo(() => {
    const out: { key: string; at: string; type: RowType; ref: string; vendor: string; vendorId?: string; invitedBy: string; stage: string; status: string; rawStatus: string; details: string; duration: string; gstin: string; company: string; sap: string }[] = [];
    const vf = (id?: string) => { const v = vendorsMap[id ?? '']; return { ref: v?.reference_number ?? '', vendor: v ? vName(v) : '', status: v ? titleCase(v.status) : '', rawStatus: v?.status ?? '', gstin: v?.gstin ?? '', company: tenantNames[v?.tenant_id] ?? '', sap: v?.sap_vendor_code ?? '' }; };
    pendingRows.forEach((p) => out.push({ key: `p${p.vendor_id}${p.stage}`, at: p.started_at ?? p.created_at, type: 'Pending', vendorId: p.vendor_id, ...vf(p.vendor_id),
      invitedBy: invitedByText(p.vendor_id), stage: stageLabel(p.stage), details: 'Waiting For This User', duration: fmtWait(hoursSince(p.started_at ?? p.created_at)) }));
    actionRows.forEach((h) => { const t = classifyAction(h.action); if (t === 'Other') return; out.push({ key: `a${h.id}`, at: h.acted_at, type: t as RowType, vendorId: h.vendor_id, ...vf(h.vendor_id),
      invitedBy: invitedByText(h.vendor_id), stage: stageLabel(h.stage), details: h.comments || '', duration: fmtWait(hrs2(h.started_at, h.acted_at)) }); });
    invites.filter((i) => i.created_by === userId && inRange(i.created_at) && (!i.vendor_id || vendorOk(vendorsMap[i.vendor_id]) || (company === 'all' && status === 'all'))).forEach((i) => {
      const v = vf(i.vendor_id); if (!matchQ(v.vendor, i.vendor_name, i.email, v.ref)) return;
      out.push({ key: `i${i.id}`, at: i.created_at, type: i.created_on_behalf ? 'On Behalf' : 'Invited', vendorId: i.vendor_id ?? undefined, ...v, vendor: v.vendor || i.vendor_name || i.email,
        invitedBy: i.created_on_behalf ? 'Self (On Behalf)' : 'Self', stage: '', details: i.used_at ? `Link Opened ${formatDate(i.used_at)}` : i.email, duration: '' }); });
    return out.sort((x, y) => (x.type === 'Pending' ? 0 : 1) - (y.type === 'Pending' ? 0 : 1) || (y.at ?? '').localeCompare(x.at ?? ''));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRows, actionRows, activityRows, invites, vendorsMap, vInvites, userId, from, to, company, status, q]);
  const [typeFilter, setTypeFilter] = useState<'All' | RowType>('All');
  const shown = typeFilter === 'All' ? combined : combined.filter((r) => r.type === typeFilter);
  const cPage = usePaged(shown);
  useEffect(() => { cPage.reset(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, from, to, company, status, q, typeFilter]);
  const combinedExport = () => combined.map((r) => ({ 'Action Date': formatDateTime(r.at, ''), Action: r.type, 'Ref No': r.ref, 'Vendor Name': r.vendor,
    GSTIN: r.gstin, Company: r.company, 'Invited By': r.invitedBy, 'Approval Stage': r.stage, Comments: r.details, 'Current Vendor Status': r.status, 'SAP Code': r.sap }));

  const roles = (rolesBy[userId] ?? []).map(titleCase).join(', ') || '—';
  const companies = (tenantsBy[userId] ?? []).map((t) => tenantNames[t]).filter(Boolean).join(', ') || 'All Companies';
  const statuses = [...new Set(Object.values(vendorsMap).map((v: any) => v.status))].sort();

  const buildExport = () => {
    if (!user) return null;
    return {
      userName: user.full_name || user.email,
      summary: {
        'User Name': user.full_name ?? '', Email: user.email, Roles: roles, Status: titleCase(user.status),
        'Date Range': from || to ? `${from ? formatDate(from) : 'Start'} to ${to ? formatDate(to) : 'Today'}` : 'All Time',
        'Vendors Linked': vendorRows.length, 'Vendors Invited': invitedCount, 'Created On Behalf': behalfCount,
        Approvals: types.Approved, Rejections: types.Rejected, 'Returns / Clarifications': types.Returned,
        'Pending In Queue': pendingRows.length, 'Average Approval Time (Hours)': avg ?? '—', 'SAP Synced Vendors': sapSynced,
        'Generated On': formatDateTime(new Date()),
      },
      vendors: vendorRows.map((r) => ({ vendor: { ...r.vendor, company: tenantNames[r.vendor.tenant_id] ?? '', invited_by: invitedByText(r.vendor.id) }, relation: r.relation })),
      actions: actionRows.map((h) => ({
        'Date / Time': formatDateTime(h.acted_at), 'Reference No': h.vendor?.reference_number ?? '', Vendor: vName(h.vendor), 'Invited By': invitedByText(h.vendor_id),
        Stage: stageLabel(h.stage), Action: classifyAction(h.action) === 'Other' ? titleCase(h.action) : classifyAction(h.action),
        Comments: h.comments ?? '', 'Time Taken (Hours)': h.started_at ? Math.round((new Date(h.acted_at).getTime() - new Date(h.started_at).getTime()) / 36e5 * 10) / 10 : '',
      })),
      pending: pendingRows.map((p) => ({
        'Reference No': p.vendor?.reference_number ?? '', Vendor: vName(p.vendor), 'Invited By': invitedByText(p.vendor_id), Stage: stageLabel(p.stage),
        'Waiting Since': formatDateTime(p.started_at ?? p.created_at), 'Waiting For': fmtWait(hoursSince(p.started_at ?? p.created_at)),
      })),
      activity: activityRows.map((a) => ({
        'Date / Time': formatDateTime(a.created_at), Action: titleCase(a.action), Vendor: vName(vendorsMap[a.vendor_id]) === 'Unnamed Vendor' ? '' : vName(vendorsMap[a.vendor_id]),
        Details: JSON.stringify(a.details ?? {}), 'IP Address': a.ip_address ?? '',
      })),
    };
  };
  const roleSet = new Set(rolesBy[userId] ?? []);
  const isBuyer = roleSet.has('buyer');
  const isApprover = ['approver', 'scm_manager', 'scm_head', 'finance_1', 'finance_2', 'ceo_office'].some((x) => roleSet.has(x as any));
  const isSap = roleSet.has('sap_team');
  const ALL_TILES = [
    { k: 'inv', icon: Send, label: 'Vendors Invited', value: invitedCount, tone: 'primary', show: isBuyer },
    { k: 'beh', icon: Users, label: 'Created On Behalf', value: behalfCount, tone: 'accent', show: isBuyer },
    { k: 'app', icon: CheckCircle2, label: 'Approvals', value: types.Approved, tone: 'success', show: isApprover || isSap },
    { k: 'rej', icon: XCircle, label: 'Rejections', value: types.Rejected, tone: 'destructive', show: isApprover },
    { k: 'ret', icon: RotateCcw, label: 'Returns / Clarifications', value: types.Returned, tone: 'warning', show: isApprover },
    { k: 'pen', icon: Hourglass, label: 'Pending In Queue', value: pendingRows.length, tone: 'warning', show: isBuyer || isApprover || isSap },
    { k: 'avg', icon: Timer, label: 'Avg Approval Time', value: avg == null ? '—' : `${avg} h`, tone: 'accent', show: isApprover || isSap },
    { k: 'sap', icon: RefreshCw, label: 'SAP Synced Vendors', value: sapSynced, tone: 'success', show: isBuyer || isSap },
    { k: 'ven', icon: Building2, label: 'Vendors Linked', value: vendorRows.length, tone: 'primary', show: !isBuyer && !isApprover && !isSap },
    { k: 'act', icon: Clock, label: 'Activity Records', value: activityRows.length, tone: 'accent', show: !isBuyer && !isApprover && !isSap },
  ];
  const tiles = ALL_TILES.filter((t) => t.show || (typeof t.value === 'number' && t.value > 0));
  const doExport = () => { const d = buildExport(); if (d) exportUserAudit({ ...d, all: combinedExport() }); };
  const doPdf = () => {
    const d = buildExport(); if (!d) return;
    exportUserAuditPdf({ userName: d.userName, summary: d.summary, all: combinedExport() });
  };

  return (
    <div className="space-y-2 text-[11px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="!text-[15px] font-bold text-foreground flex items-center gap-2"><span className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shadow-sm"><FileSpreadsheet className="h-4 w-4" /></span>User Audit Report</h1>
          <p className="text-xs text-muted-foreground">Select A User To See Every Vendor, Approval And Action Linked To Them.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" style={{ height: 28, fontSize: 11 }} variant="outline" disabled={!userId || loading} onClick={() => load(userId)}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
          <Button size="sm" style={{ height: 28, fontSize: 11 }} variant="outline" disabled={!user || loading} onClick={doPdf} className="border-destructive/30 text-destructive hover:bg-destructive/10"><FileText className="h-4 w-4 mr-1" />Download PDF</Button>
          <Button size="sm" style={{ height: 28, fontSize: 11 }} disabled={!user || loading} onClick={doExport} className="bg-gradient-to-r from-primary to-primary/80"><Download className="h-4 w-4 mr-1" />Export To Excel</Button>
        </div>
      </div>

      <Card className="rounded-[10px]">
        <CardContent className="p-3 grid gap-2 md:grid-cols-2 lg:grid-cols-6 !p-2 [&_input]:!h-7 [&_input]:!text-[11px] [&_button]:!h-7 [&_button]:!text-[11px] [&_p]:!text-[10px]">
          <div className="lg:col-span-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">User</p>
            <div className="relative" ref={pickerRef}>
                <Button type="button" onClick={() => setPickerOpen((o) => !o)} variant="outline" role="combobox" className="w-full justify-between font-normal">
                  <span className="truncate">{user ? `${user.full_name || user.email}` : 'Select A User'}</span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              {pickerOpen && (
              <div className="absolute left-0 top-full z-50 mt-1 w-[360px] max-w-[90vw] rounded-md border bg-popover text-popover-foreground shadow-md">
                <Command>
                  <CommandInput autoFocus placeholder="Search Name Or Email..." />
                  <CommandList>
                    <CommandEmpty>No Users Found.</CommandEmpty>
                    <CommandGroup>
                      {profiles.map((p) => (
                        <CommandItem
                          key={p.id}
                          value={p.id}
                          keywords={[p.full_name ?? '', p.email ?? '']}
                          onSelect={() => { setUserId(p.id); setPickerOpen(false); }}
                          onPointerDown={(e) => e.preventDefault()}
                          onClick={() => { setUserId(p.id); setPickerOpen(false); }}
                          className="cursor-pointer"
                        >
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
              </div>
              )}
            </div>
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
          <Card className="rounded-[10px] border-l-4 border-l-primary bg-gradient-to-r from-primary/10 via-card to-card shadow-sm">
            <CardContent className="p-2.5 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shadow"><UserRound className="h-4 w-4" /></div>
                <div><p className="font-semibold text-foreground">{user?.full_name || user?.email}</p>
                  <Badge variant={user?.status === 'active' ? 'default' : 'secondary'}>{titleCase(user?.status ?? '')}</Badge></div>
              </div>
              <div className="text-xs"><p className="text-muted-foreground text-[11px] flex items-center gap-1"><Mail className="h-3 w-3" />Email</p>{user?.email}</div>
              <div className="text-xs"><p className="text-muted-foreground text-[11px]">Roles</p>{roles}</div>
              <div className="text-xs"><p className="text-muted-foreground text-[11px] flex items-center gap-1"><Clock className="h-3 w-3" />Last Login</p>{formatDateTime(user?.last_login_attempt_at, '—')}</div>
              <div className="text-xs"><p className="text-muted-foreground text-[11px]">User Since</p>{formatDate(user?.created_at, '—')}</div>
            </CardContent>
          </Card>


          <Card className="rounded-[10px] shadow-sm">
            <CardContent className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex flex-wrap gap-1.5">
                  {(['All', ...TYPE_ORDER] as const).map((t) => { const n = t === 'All' ? combined.length : combined.filter((r) => r.type === t).length;
                    if (t !== 'All' && !n) return null; const on = typeFilter === t;
                    return <button key={t} type="button" onClick={() => setTypeFilter(t)}
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${on ? (t === 'All' ? 'bg-primary text-primary-foreground border-primary' : TYPE_STYLE[t].chipOn) : (t === 'All' ? 'bg-card text-foreground' : TYPE_STYLE[t].chip)}`}>{t} ({n})</button>; })}
                </div>
                <div className="relative w-full sm:w-60"><Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input className="pl-8 h-8 text-xs" placeholder="Search Any Column..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
              </div>
              <div className="rounded-md border overflow-x-auto"><Table className="w-max min-w-full">
                <TableHeader className="bg-gradient-to-r from-primary/15 via-primary/5 to-success/10 sticky top-0"><TableRow className="hover:bg-transparent">
                  <TableHead className={`${TH}`}>Action Date</TableHead><TableHead className={`${TH}`}>Action</TableHead>
                  <TableHead className={`${TH}`}>Ref No</TableHead><TableHead className={`${TH}`}>Vendor Name</TableHead>
                  <TableHead className={`${TH}`}>GSTIN</TableHead><TableHead className={`${TH}`}>Company</TableHead>
                  <TableHead className={`${TH}`}>Invited By</TableHead><TableHead className={`${TH}`}>Approval Stage</TableHead>
                  <TableHead className={`${TH}`}>Comments</TableHead><TableHead className={`${TH}`}>Current Vendor Status</TableHead>
                  <TableHead className={`${TH}`}>SAP Code</TableHead><TableHead className={`${TH} sticky right-0 bg-card`} /></TableRow></TableHeader>
                <TableBody>{cPage.rows.length ? cPage.rows.map((r) => (
                  <TableRow key={r.key} className={`border-l-4 ${TYPE_STYLE[r.type].row}`}>
                    <TableCell className={TD}>{formatDateTime(r.at, '—')}</TableCell>
                    <TableCell className={TD}><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${TYPE_STYLE[r.type].pill}`}>{TYPE_LABEL[r.type] ?? r.type}</span></TableCell>
                    <TableCell className={`${TD} font-mono text-[11px] whitespace-nowrap`} title={r.ref}>{r.ref || '—'}</TableCell>
                    <TableCell className={`${TD} font-medium whitespace-nowrap`} title={r.vendor}>{r.vendor || '—'}</TableCell>
                    <TableCell className={`${TD} font-mono text-[10px] whitespace-nowrap`} title={r.gstin}>{r.gstin || '—'}</TableCell>
                    <TableCell className={`${TD} whitespace-nowrap`} title={r.company}>{r.company || '—'}</TableCell>
                    <TableCell className={`${TD} whitespace-nowrap`} title={r.invitedBy}>{r.invitedBy || '—'}</TableCell>
                    <TableCell className={`${TD} whitespace-nowrap`}>{r.stage || '—'}</TableCell>
                    <TableCell className={`${TD} whitespace-nowrap text-muted-foreground`} title={r.details}>{r.details || '—'}</TableCell>
                    <TableCell className={TD}>{r.status ? <Badge variant="outline" className={`text-[10px] whitespace-nowrap max-w-full whitespace-nowrap ${STATUS_BADGE(r.rawStatus)}`}>{r.status}</Badge> : '—'}</TableCell>
                    <TableCell className={`${TD} font-mono whitespace-nowrap`}>{r.sap || '—'}</TableCell>
                    <TableCell className={`${TD} sticky right-0 bg-card`}>{r.vendorId && <Button size="sm" style={{ height: 28, fontSize: 11 }} variant="ghost" className="h-6 px-1.5 text-[11px]" onClick={() => setReviewId(r.vendorId!)}><Eye className="h-3.5 w-3.5" /></Button>}</TableCell>
                  </TableRow>)) : <EmptyRow cols={12} />}</TableBody></Table></div>{cPage.pager}
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
function InvBy({ b }: { b: { name: string; behalf: boolean } }) {
  return <div className="flex flex-col gap-0.5"><span>{b.name}</span>{b.behalf && <Badge variant="outline" className="w-fit text-[10px] bg-primary/10 text-primary border-primary/30">On Behalf</Badge>}</div>;
}
