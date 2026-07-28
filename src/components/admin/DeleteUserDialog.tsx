import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
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
  vendor_invitations?: number;
}


interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  targetUser: { id: string; email: string; full_name: string | null } | null;
  onDeleted: () => void;
}

export function DeleteUserDialog({ open, onOpenChange, targetUser, onDeleted }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [eligible, setEligible] = useState<EligibleUser[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [replacementId, setReplacementId] = useState<string>('');

  useEffect(() => {
    if (!open || !targetUser) return;
    setReplacementId('');
    setEligible([]);
    setCounts(null);
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('reassign-user-work', {
          body: { mode: 'preview', inactive_user_id: targetUser.id },
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
  }, [open, targetUser, toast]);

  const hasWork = !!counts && (counts.buyer_approval_flows + counts.approval_matrix_approvers + counts.buyer_scm_mappings + (counts.vendor_invitations ?? 0) > 0);

  const handleDelete = async () => {
    if (!targetUser) return;
    if (hasWork && !replacementId) return;
    setApplying(true);
    try {
      const body: Record<string, unknown> = { user_id: targetUser.id };
      if (replacementId) body.replacement_user_id = replacementId;
      const { data, error } = await supabase.functions.invoke('admin-delete-user', { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: 'User deleted', description: targetUser.email });
      onDeleted();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message ?? String(err), variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !applying && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete User</DialogTitle>
          <DialogDescription>
            Permanently delete this user. If they have active approval work, choose a replacement to
            take over pending approvals, approval matrix roles, and buyer↔SCM mappings before deletion.
          </DialogDescription>
        </DialogHeader>

        {targetUser && (
          <div className="rounded-md border p-3 bg-muted/30 space-y-1 text-sm">
            <div><span className="text-muted-foreground">User:</span> <strong>{targetUser.full_name || targetUser.email}</strong></div>
            <div><span className="text-muted-foreground">Email:</span> {targetUser.email}</div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking workload…
          </div>
        ) : (
          <>
            {counts && (
              <div className="text-xs text-muted-foreground">
                Active workload: <strong>{counts.vendor_invitations ?? 0}</strong> vendor invitation(s),{' '}
                <strong>{counts.buyer_approval_flows}</strong> approval flow(s),{' '}
                <strong>{counts.approval_matrix_approvers}</strong> matrix assignment(s),{' '}
                <strong>{counts.buyer_scm_mappings}</strong> buyer↔SCM mapping(s).
              </div>
            )}


            {hasWork && (
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
                  All pending approvals and role assignments will move to this user before deletion.
                </p>
              </div>
            )}

            {hasWork && eligible.length === 0 && (
              <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div>
                  No eligible replacement found. Create or assign another user with the same role before deleting.
                </div>
              </div>
            )}

            {!hasWork && counts && (
              <div className="text-sm text-muted-foreground">
                No active workload — this user can be deleted directly.
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={applying || loading || (hasWork && !replacementId)}
          >
            {applying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {hasWork ? 'Reassign & Delete' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
