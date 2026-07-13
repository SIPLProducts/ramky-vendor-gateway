import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EligibleUser { id: string; email: string; full_name: string | null; }
interface Counts {
  buyer_approval_flows: number;
  approval_matrix_approvers: number;
  buyer_scm_mappings: number;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  inactiveUser: { id: string; email: string; full_name: string | null; roleLabel: string; tenantNames: string[] } | null;
  onConfirmed: () => void; // called after successful reassignment (caller then flips status)
}

export function ReplaceUserDialog({ open, onOpenChange, inactiveUser, onConfirmed }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [eligible, setEligible] = useState<EligibleUser[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [replacementId, setReplacementId] = useState<string>('');

  useEffect(() => {
    if (!open || !inactiveUser) return;
    setReplacementId('');
    setEligible([]);
    setCounts(null);
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('reassign-user-work', {
          body: { mode: 'preview', inactive_user_id: inactiveUser.id },
        });
        if (error) throw error;
        if ((data as any)?.error) throw new Error((data as any).error);
        setEligible((data as any).eligible ?? []);
        setCounts((data as any).counts ?? null);
      } catch (err: any) {
        toast({ title: 'Failed to load replacements', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [open, inactiveUser, toast]);

  const handleConfirm = async () => {
    if (!inactiveUser || !replacementId) return;
    setApplying(true);
    try {
      const { data, error } = await supabase.functions.invoke('reassign-user-work', {
        body: {
          mode: 'apply',
          inactive_user_id: inactiveUser.id,
          replacement_user_id: replacementId,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const c = (data as any).counts as Counts;
      toast({
        title: 'Work reassigned',
        description: `Approval flows: ${c.buyer_approval_flows}, matrix: ${c.approval_matrix_approvers}, mappings: ${c.buyer_scm_mappings}`,
      });
      onConfirmed();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Reassignment failed', description: err.message, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const hasWork = !!counts && (counts.buyer_approval_flows + counts.approval_matrix_approvers + counts.buyer_scm_mappings > 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !applying && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Replace User Before Inactivation</DialogTitle>
          <DialogDescription>
            Transfer all pending approvals, approval matrix roles and buyer↔SCM mappings from this user
            to an active replacement. This keeps in-progress vendor workflows moving.
          </DialogDescription>
        </DialogHeader>

        {inactiveUser && (
          <div className="rounded-md border p-3 bg-muted/30 space-y-1 text-sm">
            <div><span className="text-muted-foreground">User:</span> <strong>{inactiveUser.full_name || inactiveUser.email}</strong></div>
            <div><span className="text-muted-foreground">Email:</span> {inactiveUser.email}</div>
            <div><span className="text-muted-foreground">Role:</span> {inactiveUser.roleLabel}</div>
            <div>
              <span className="text-muted-foreground">Tenants:</span>{' '}
              {inactiveUser.tenantNames.length > 0 ? inactiveUser.tenantNames.join(', ') : '—'}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading eligible replacements…
          </div>
        ) : (
          <>
            {counts && (
              <div className="text-xs text-muted-foreground">
                Impact: <strong>{counts.buyer_approval_flows}</strong> approval flow(s),{' '}
                <strong>{counts.approval_matrix_approvers}</strong> matrix assignment(s),{' '}
                <strong>{counts.buyer_scm_mappings}</strong> buyer↔SCM mapping(s) will be transferred.
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Replacement User <span className="text-destructive">*</span></Label>
              <Select value={replacementId} onValueChange={setReplacementId} disabled={eligible.length === 0}>
                <SelectTrigger>
                  <SelectValue placeholder={eligible.length === 0 ? 'No eligible replacements available' : 'Select replacement'} />
                </SelectTrigger>
                <SelectContent>
                  {eligible.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ? `${u.full_name} — ${u.email}` : u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Only active users with the same role and overlapping tenant access are shown.
              </p>
            </div>

            {eligible.length === 0 && hasWork && (
              <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  No eligible replacement found. Create or assign another user with the same role and tenant access before inactivating.
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!replacementId || applying || loading}>
            {applying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirm & Inactivate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
