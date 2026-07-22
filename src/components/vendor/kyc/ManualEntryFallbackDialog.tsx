import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ManualEntryFallbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  maxLength?: number;
  pattern?: RegExp;
  initialValue?: string;
  /** Called on Verify click. Return { ok, message } — on ok the dialog closes. */
  onVerify: (value: string) => Promise<{ ok: boolean; message?: string }>;
}

export function ManualEntryFallbackDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  maxLength,
  pattern,
  initialValue = '',
  onVerify,
}: ManualEntryFallbackDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(null);
      setBusy(false);
    }
  }, [open, initialValue]);

  const valid = value.length > 0 && (!maxLength || value.length === maxLength) && (!pattern || pattern.test(value));

  const handleVerify = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await onVerify(value);
      if (r.ok) {
        onOpenChange(false);
      } else {
        setError(r.message || 'Verification failed. Please check the value and try again.');
      }
    } catch (e: any) {
      setError(e?.message || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!busy ? onOpenChange(v) : null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Label htmlFor="manual-fallback-input">{label}</Label>
          <Input
            id="manual-fallback-input"
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            placeholder={placeholder}
            maxLength={maxLength}
            className="uppercase font-mono"
            autoFocus
          />
          {error && (
            <Alert className="border-destructive/30 bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <AlertDescription className="text-destructive text-sm">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={handleVerify} disabled={!valid || busy}>
            {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            Verify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
