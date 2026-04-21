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

const ROLES: AppRole[] = ['vendor', 'sharvi_admin'];

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

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const symbols = '!@#$%';
  let pw = '';
  for (let i = 0; i < 12; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  pw += symbols[Math.floor(Math.random() * symbols.length)];
  return pw;
}

export function CreateUserDialog({ open, onOpenChange, tenants, customRoles = [], defaultTenantId = null, onCreated }: Props) {
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  // selectedRole = built-in AppRole OR "custom:<custom_role_id>"
  const [selectedRole, setSelectedRole] = useState<string>('vendor');
  const [tenantIds, setTenantIds] = useState<string[]>(defaultTenantId ? [defaultTenantId] : []);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && defaultTenantId && tenantIds.length === 0) {
      setTenantIds([defaultTenantId]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultTenantId]);

  const reset = () => {
    setFullName(''); setEmail(''); setPassword(''); setSelectedRole('vendor');
    setTenantIds(defaultTenantId ? [defaultTenantId] : []); setShowPw(false);
  };

  const toggleTenant = (id: string) => {
    setTenantIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  const isCustom = selectedRole.startsWith('custom:');
  const customRoleId = isCustom ? selectedRole.slice('custom:'.length) : null;
  // Built-in role to actually persist in user_roles. For custom selection, default to 'vendor'
  // (the custom role drives screen permissions; user_roles still requires an enum value).
  const builtInRole: AppRole = isCustom ? 'vendor' : (selectedRole as AppRole);

  const handleSubmit = async () => {
    if (!email || !password || !selectedRole) {
      toast({ title: 'Missing fields', description: 'Email, password and role are required', variant: 'destructive' });
      return;
    }
    if (password.length < 8) {
      toast({ title: 'Weak password', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: email.trim(), password, full_name: fullName.trim() || null,
          role: builtInRole,
          tenant_ids: tenantIds,
          custom_role_ids: customRoleId ? [customRoleId] : [],
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const roleLabel = isCustom
        ? (customRoles.find((c) => c.id === customRoleId)?.name ?? 'custom role')
        : builtInRole;
      toast({ title: 'User created', description: `${email} added as ${roleLabel}` });
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>Create a new application user with role and tenant access.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
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
          <div className="space-y-2">
            <Label>Tenants (optional)</Label>
            <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
              {tenants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tenants available</p>
              ) : tenants.map((t) => (
                <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox checked={tenantIds.includes(t.id)} onCheckedChange={() => toggleTenant(t.id)} />
                  <span className="text-sm">{t.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
