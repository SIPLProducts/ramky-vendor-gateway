import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { AppRole } from './ChangeRoleDialog';

const ROLES: AppRole[] = ['vendor', 'admin', 'sharvi_admin'];

interface Tenant { id: string; name: string; }
interface CustomRoleOpt { id: string; name: string; is_active: boolean; }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenants: Tenant[];
  customRoles?: CustomRoleOpt[];
  defaultTenantId?: string | null;
  onCreated: () => void;
}

interface SapTenant { code: string; name: string; }

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const symbols = '!@#$%';
  let pw = '';
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  pw += symbols[Math.floor(Math.random() * symbols.length)];
  return pw;
}

export function CreateUserDialog({ open, onOpenChange, customRoles = [], onCreated }: Props) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('vendor');
  const [saving, setSaving] = useState(false);

  // SAP tenants state
  const [sapTenants, setSapTenants] = useState<SapTenant[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [fetchingSap, setFetchingSap] = useState(false);
  const [sapFetched, setSapFetched] = useState(false);
  const [sapError, setSapError] = useState<string | null>(null);
  const [sapHint, setSapHint] = useState<string | null>(null);

  const reset = () => {
    setFullName(''); setEmail(''); setPassword(''); setSelectedRole('vendor');
    setShowPw(false);
    setSapTenants([]); setSelectedCodes([]); setSapFetched(false); setSapError(null); setSapHint(null); setFetchingSap(false);
  };

  useEffect(() => { if (!open) reset(); /* eslint-disable-next-line */ }, [open]);

  const toggleCode = (code: string) => {
    setSelectedCodes((prev) => prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]);
  };

  const fetchSapTenants = async () => {
    if (tenantOptional) return;
    const trimmed = email.trim();
    if (!trimmed || !/.+@.+\..+/.test(trimmed)) {
      setSapError('Please enter a valid email first.');
      setSapFetched(true);
      setSapTenants([]);
      return;
    }
    setFetchingSap(true); setSapError(null); setSapHint(null);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-tenants-from-sap', {
        body: { email: trimmed },
      });
      if (error) throw error;
      if (!(data as any)?.success) {
        setSapHint((data as any)?.hint ?? null);
        throw new Error((data as any)?.message || 'Failed to fetch tenants from SAP');
      }
      const list: SapTenant[] = ((data as any).tenants ?? []).map((t: any) => ({
        code: String(t.code),
        name: String(t.name || t.code),
      }));
      setSapTenants(list);
      setSelectedCodes(list.map((t) => t.code));
      setSapFetched(true);
      if (list.length === 0) {
        toast({ title: 'No tenants', description: 'SAP returned no tenants for this email.' });
      }
    } catch (err: any) {
      setSapError(err.message ?? String(err));
      setSapTenants([]);
      setSapFetched(true);
    } finally {
      setFetchingSap(false);
    }
  };

  const isCustom = selectedRole.startsWith('custom:');
  const customRoleId = isCustom ? selectedRole.slice('custom:'.length) : null;
  const builtInRole: AppRole = isCustom ? 'approver' : (selectedRole as AppRole);
  const selectedCustomName = isCustom
    ? (customRoles.find((c) => c.id === customRoleId)?.name ?? '').trim().toLowerCase()
    : '';
  const tenantOptional =
    selectedRole === 'sharvi_admin' ||
    selectedRole === 'admin' ||
    selectedCustomName === 'admin' ||
    selectedCustomName === 'sharvi admin' ||
    selectedCustomName === 'sharvi_admin';

  useEffect(() => {
    if (tenantOptional) {
      setSapTenants([]); setSelectedCodes([]); setSapError(null); setSapFetched(false); setFetchingSap(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRole]);

  const handleSubmit = async () => {
    if (!fullName.trim()) {
      toast({ title: 'Full name required', variant: 'destructive' }); return;
    }
    if (!email || !password || !selectedRole) {
      toast({ title: 'Missing fields', description: 'Email, password and role are required', variant: 'destructive' }); return;
    }
    if (password.length < 8) {
      toast({ title: 'Weak password', description: 'Password must be at least 8 characters', variant: 'destructive' }); return;
    }
    if (!tenantOptional && selectedCodes.length === 0) {
      toast({ title: 'Tenant required', description: 'Please select at least one tenant from SAP', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      const chosen = sapTenants.filter((t) => selectedCodes.includes(t.code));
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: email.trim(), password, full_name: fullName.trim() || null,
          role: builtInRole,
          tenant_ids: [],
          sap_tenants: chosen,
          custom_role_ids: customRoleId ? [customRoleId] : [],
        },
      });

      // Try to read the server's JSON body — supabase-js throws a generic
      // FunctionsHttpError for non-2xx and hides the real message otherwise.
      let serverBody: any = data;
      if (error && (error as any).context) {
        try {
          const ctx = (error as any).context;
          if (typeof ctx.json === 'function') {
            serverBody = await ctx.json();
          } else if (typeof ctx.text === 'function') {
            const txt = await ctx.text();
            try { serverBody = JSON.parse(txt); } catch { serverBody = { error: txt }; }
          }
        } catch { /* ignore parse errors */ }
      }

      const serverError = serverBody?.error;
      const serverCode = serverBody?.code;

      if (error || serverError) {
        const isDup =
          serverCode === 'email_exists' ||
          /already been registered|already exists|email_exists/i.test(String(serverError || error?.message || ''));
        const message = isDup
          ? 'A user with this email already exists. Please edit the existing user or use a different email.'
          : (typeof serverError === 'string' ? serverError : error?.message ?? 'Failed to create user');
        toast({ title: 'Create failed', description: message, variant: 'destructive' });
        return;
      }

      toast({ title: 'User created', description: `${email} added` });
      reset();
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast({ title: 'Create failed', description: err.message ?? String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>Create a new application user with role and tenant access.</DialogDescription>
          </DialogHeader>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:rounded-full">
         <div className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" required />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setSapFetched(false); setSapTenants([]); setSelectedCodes([]); setSapError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !tenantOptional) { e.preventDefault(); fetchSapTenants(); } }}
              onBlur={() => { if (!tenantOptional && email.trim() && !sapFetched && !fetchingSap) fetchSapTenants(); }}
              placeholder="user@example.com"
            />
            {!tenantOptional && (
              <p className="text-xs text-muted-foreground">Press Enter to load tenants for this email from SAP.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Password *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="button" variant="outline" onClick={() => { setPassword(generatePassword()); setShowPw(true); }}>
                <RefreshCw className="h-4 w-4 mr-1" /> Generate
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Role *</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Built-in Roles</div>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                {customRoles.length > 0 && (
                  <>
                    <div className="px-2 py-1 mt-1 text-xs font-medium text-muted-foreground border-t">Custom Roles</div>
                    {customRoles.map((c) => (
                      <SelectItem key={c.id} value={`custom:${c.id}`} disabled={!c.is_active}>
                        {c.name}{!c.is_active && ' (inactive)'}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          {tenantOptional ? (
          <div className="space-y-2">
            <Label>Tenants <span className="text-xs font-normal text-muted-foreground">(not required)</span></Label>
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Admin roles have global access — no tenant selection required.
            </div>
          </div>
          ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tenants{tenantOptional ? '' : ' *'} <span className="text-xs font-normal text-muted-foreground">{tenantOptional ? '(optional for admin roles)' : '(from SAP)'}</span></Label>
              <Button
                type="button" variant="ghost" size="sm"
                onClick={fetchSapTenants}
                disabled={fetchingSap || !email.trim()}
              >
                {fetchingSap ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                Refresh
              </Button>
            </div>
            <div className="border rounded-md overflow-hidden">
              {sapTenants.length > 0 && !fetchingSap && !sapError && (
                <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border-b bg-muted/30">
                  <Checkbox
                    checked={
                      selectedCodes.length === sapTenants.length
                        ? true
                        : selectedCodes.length === 0
                        ? false
                        : ('indeterminate' as any)
                    }
                    onCheckedChange={() => {
                      if (selectedCodes.length === sapTenants.length) setSelectedCodes([]);
                      else setSelectedCodes(sapTenants.map((t) => t.code));
                    }}
                  />
                  <span className="text-sm font-medium">Select All</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    ({selectedCodes.length}/{sapTenants.length})
                  </span>
                </label>
              )}
              <div className="max-h-64 overflow-y-auto p-3 pr-2 space-y-2">
                {fetchingSap ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Fetching tenants from SAP…
                  </div>
                ) : sapError ? (
                  <div className="space-y-1">
                    <p className="text-sm text-destructive">{sapError}</p>
                    {sapHint && <p className="text-xs text-muted-foreground">{sapHint}</p>}
                  </div>
                ) : !sapFetched ? (
                  <p className="text-sm text-muted-foreground">Enter the email above and press Enter to load tenants from SAP.</p>
                ) : sapTenants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tenants returned by SAP for this email.</p>
                ) : (
                  sapTenants.map((t) => (
                    <label key={t.code} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={selectedCodes.includes(t.code)} onCheckedChange={() => toggleCode(t.code)} />
                      <span className="text-sm">{t.name} <span className="text-xs text-muted-foreground">({t.code})</span></span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          )}
         </div>
        </div>
        <div className="px-6 py-4 border-t">
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
