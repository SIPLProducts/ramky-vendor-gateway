import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a number');

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });

    (async () => {
      try {
        // 1) Error passed in the hash from Supabase verify endpoint
        const rawHash = window.location.hash.startsWith('#')
          ? window.location.hash.slice(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(rawHash);
        const search = new URLSearchParams(window.location.search);

        const hashError = hashParams.get('error_description') || hashParams.get('error');
        const queryError = search.get('error_description') || search.get('error');
        if (hashError || queryError) {
          const msg = decodeURIComponent((hashError || queryError || '').replace(/\+/g, ' '));
          if (!cancelled) setError(msg || 'This reset link is invalid or has expired. Please request a new one.');
          return;
        }

        // 2) PKCE flow: ?code=...
        const code = search.get('code');
        if (code) {
          const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (exchangeErr) {
            setError(exchangeErr.message || 'Reset link is invalid or has expired. Please request a new one.');
            return;
          }
          setReady(true);
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        // 3) Implicit flow: #access_token=...&refresh_token=...&type=recovery
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error: setErr } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (cancelled) return;
          if (setErr) {
            setError(setErr.message || 'Reset link is invalid or has expired. Please request a new one.');
            return;
          }
          setReady(true);
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        // 4) Fallback: already-authenticated recovery session
        const { data } = await supabase.auth.getSession();
        if (!cancelled && data.session) setReady(true);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Unable to process reset link.');
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);


  const validate = (): string | null => {
    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) return parsed.error.errors[0].message;
    if (newPassword !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      toast.error(updateError.message || 'Unable to change password');
      return;
    }
    toast.success('Password changed successfully');
    await supabase.auth.signOut();
    setTimeout(() => navigate('/auth'), 600);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-0 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Reset Password
          </CardTitle>
          <CardDescription>
            Choose a strong new password for your Sharvi Vyapaar Portal account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <Alert variant={error ? 'destructive' : 'default'}>
              <AlertDescription className="text-sm">
                {error
                  ? error
                  : 'Verifying your reset link…  If nothing happens, request a new link from the login page.'}
              </AlertDescription>
            </Alert>
          ) : (

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    required
                    maxLength={128}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    required
                    maxLength={128}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Min 8 characters with uppercase, lowercase, and a number.
              </p>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
