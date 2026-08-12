import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { AppRole } from './ChangeRoleDialog';

const ALL_ROLES: AppRole[] = ['vendor', 'finance', 'purchase', 'approver', 'customer_admin', 'admin', 'sharvi_admin'];

interface Tenant { id: string; name: string; code?: string | null; }
interface CustomRoleOpt { id: string; name: string; is_active: boolean; }
interface SapTenant { code: string; name: string; }

export interface EditUserData {
  id: string;
  full_name: string | null;
  status: 'active' | 'inactive';
  email: string;
  role: AppRole | null;
  tenantIds: string[];
  customRoleIds: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: EditUserData | null;
  tenants: Tenant[];
  customRoles: CustomRoleOpt[];
  disableRoleAndAccess?: boolean;
  onSave: (patch: {
    full_name: string;
    status: 'active' | 'inactive';
    role: AppRole;
    tenantIds: string[];
    customRoleIds: string[];
  }) => Promise<void>;
}

export function EditUserDialog({
  open, onOpenChange, user, tenants, customRoles, disableRoleAndAccess = false, onSave,
}: Props) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [selectedRole, setSelectedRole] = useState<string>('vendor');
  const [tenantIds, setTenantIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // SAP-fetched tenant state (mirrors CreateUserDialog)
  const [sapTenants, setSapTenants] = useState<SapTenant[]>([]);
  const [sapFetched, setSapFetched] = useState(false);
  const [fetchingSap, setFetchingSap] = useState(false);
  const [sapError, setSapError] = useState<string | null>(null);

  useEffect(() => {
    if (open && user) {
      setFullName(user.full_name ?? '');
      setStatus(user.status);
      setSelectedRole(
        user.customRoleIds[0]
          ? `custom:${user.customRoleIds[0]}`
          : (user.role ?? 'vendor')
      );
      setTenantIds(user.tenantIds);
      // reset SAP state each open
      setSapTenants([]);
      setSapFetched(false);
      setFetchingSap(false);
      setSapError(null);
    }
  }, [open, user]);

  const fetchSapTenants = async () => {
    const trimmed = (user?.email ?? '').trim();
    if (!trimmed) return;
    setFetchingSap(true); setSapError(null);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-tenants-from-sap', {
        body: { email: trimmed },
      });
      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.message || 'Failed to fetch tenants from SAP');
      const list: SapTenant[] = ((data as any).tenants ?? []).map((t: any) => ({
        code: String(t.code),
        name: String(t.name || t.code),
      }));
      setSapTenants(list);
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

  // Resolve fetched SAP tenants -> local tenant IDs (server-side upsert by code).
  const resolveSapTenantIds = async (list: SapTenant[]): Promise<string[]> => {
    if (list.length === 0) return [];
    const { data, error } = await supabase.functions.invoke('resolve-sap-tenants', {
      body: { sap_tenants: list.map((t) => ({ code: t.code, name: t.name })) },
    });
    if (error) throw new Error(error.message || 'Could not save SAP tenants.');
    if ((data as any)?.error) throw new Error((data as any).error);
    return ((data as any)?.tenant_ids ?? []) as string[];
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isCustom = selectedRole.startsWith('custom:');
      const customRoleId = isCustom ? selectedRole.slice('custom:'.length) : null;
      const builtInRole: AppRole = isCustom ? 'vendor' : (selectedRole as AppRole);

      let finalTenantIds = tenantIds;
      if (sapFetched && sapTenants.length > 0) {
        finalTenantIds = await resolveSapTenantIds(sapTenants);
      }

      await onSave({
        full_name: fullName.trim(),
        status,
        role: builtInRole,
        tenantIds: finalTenantIds,
        customRoleIds: customRoleId ? [customRoleId] : [],
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message ?? String(err), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Tenants to display in the read-only panel
  const displayTenants: { code?: string; name: string }[] = sapFetched
    ? sapTenants
    : tenantIds
        .map((id) => tenants.find((t) => t.id === id))
        .filter((t): t is Tenant => !!t)
        .map((t) => ({ code: t.code ?? undefined, name: t.name }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update name, status{disableRoleAndAccess ? '' : ', role and tenant access'}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <div className="flex gap-2">
              <Input value={user?.email ?? ''} disabled className="flex-1" />
              <Button
                type="button"
                variant="outline"
                onClick={fetchSapTenants}
                disabled={fetchingSap || disableRoleAndAccess}
              >
                {fetchingSap ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Fetch
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Click Fetch to refresh Tenant Access from SAP for this email.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Full Name</Label>
            <Input id="edit-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as 'active' | 'inactive')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            {status === 'inactive' && (
              <p className="text-xs text-muted-foreground">
                Inactive users cannot log in. Their login attempts are logged for review.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole} disabled={disableRoleAndAccess}>
              <SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Built-in Roles</div>
                {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
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
            {disableRoleAndAccess && (
              <p className="text-xs text-muted-foreground">You cannot change your own role or access.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Tenant Access {sapFetched && <span className="text-xs text-muted-foreground">(from SAP)</span>}</Label>
              {sapFetched && sapTenants.length > 0 && (
                <span className="text-xs text-muted-foreground">{sapTenants.length} tenant(s)</span>
              )}
            </div>
            {sapError ? (
              <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>{sapError}</div>
              </div>
            ) : fetchingSap ? (
              <div className="border rounded-md p-3 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Fetching tenants from SAP…
              </div>
            ) : displayTenants.length > 0 ? (
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-1 bg-muted/20">
                {displayTenants.map((t, i) => (
                  <div key={`${t.code ?? t.name}-${i}`} className="text-sm">
                    {t.code ? <span className="font-mono text-xs text-muted-foreground mr-2">{t.code}</span> : null}
                    {t.name}
                  </div>
                ))}
              </div>
            ) : (
              <div className="border rounded-md p-3 text-sm text-muted-foreground">
                {sapFetched ? 'No tenants returned by SAP.' : 'No tenants assigned. Click Fetch to load from SAP.'}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Read-only. To modify, click Fetch to pull the latest list from SAP.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
