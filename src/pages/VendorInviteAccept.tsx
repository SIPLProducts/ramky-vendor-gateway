import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, ShieldCheck, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ramkyLogo from '@/assets/ramky-logo.png';

type Phase = 'loading' | 'redirecting' | 'denied' | 'error';

export default function VendorInviteAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      if (!token) {
        setErrorMsg('No invitation token provided. Please use the link from your email.');
        setPhase('error');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('claim-vendor-invite', {
          body: { token, redirectOrigin: window.location.origin },
        });

        const d = (data as any) || {};
        const status = d.status;
        const code = d.code;

        if (error && !status) {
          setErrorMsg('We could not open your invitation. Please try again shortly.');
          setPhase('error');
          return;
        }

        if (status === 'claimed' && d.session?.access_token && d.session?.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: d.session.access_token,
            refresh_token: d.session.refresh_token,
          });
          if (sessionError) {
            console.error('Unable to set invite session:', sessionError);
            setErrorMsg('We could not sign you in from this invitation. Please try again shortly.');
            setPhase('error');
            return;
          }
          setPhase('redirecting');
          navigate(d.redirect || `/vendor/registration?token=${encodeURIComponent(token)}`, {
            replace: true,
          });
          return;
        }

        // Backward compatibility for older deployed edge functions.
        if (status === 'claimed' && d.action_link) {
          setPhase('redirecting');
          window.location.href = d.action_link as string;
          return;
        }

        if (status === 'already_claimed_same_user') {
          setPhase('redirecting');
          navigate(d.redirect || `/vendor/registration?token=${encodeURIComponent(token)}`, {
            replace: true,
          });
          return;
        }

        if (status === 'pending') {
          // Likely a mail-security scanner prefetch; retry from the real browser click.
          setTimeout(() => { ranRef.current = false; setPhase('loading'); }, 800);
          return;
        }

        if (status === 'denied' || code === 'already_used') {
          setPhase('denied');
          return;
        }

        if (status === 'expired' || code === 'expired') {
          setErrorMsg('This invitation link has expired. Please contact the administrator.');
          setPhase('error');
          return;
        }

        if (status === 'invalid' || code === 'invalid') {
          setErrorMsg('Invalid invitation link. Please contact the administrator.');
          setPhase('error');
          return;
        }

        setErrorMsg('We could not open your invitation. Please contact the administrator.');
        setPhase('error');
      } catch (err) {
        console.error('claim-vendor-invite failed:', err);
        setErrorMsg('An unexpected error occurred. Please try again.');
        setPhase('error');
      }
    })();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="h-14 border-b bg-white/80 backdrop-blur-sm px-6 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <img src={ramkyLogo} alt="Vendor Portal" className="h-8 w-auto" />
          <span className="text-sm font-semibold text-foreground">Vendor Portal</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-xl border-0">
          {(phase === 'loading' || phase === 'redirecting') && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">
                  {phase === 'redirecting' ? 'Opening your registration…' : 'Signing you in…'}
                </CardTitle>
                <CardDescription>Please wait a moment.</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </>
          )}

          {phase === 'denied' && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Ban className="h-7 w-7 text-destructive" />
                </div>
                <CardTitle className="text-2xl text-destructive">Access Denied</CardTitle>
                <CardDescription className="pt-2">
                  This invitation link has already been used or cannot be opened by this account.
                  Only the originally invited vendor can access it.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground">
                  If you believe this is a mistake, please contact{' '}
                  <a href="mailto:vendxsupport@ramky.com" className="text-primary hover:underline">
                    vendxsupport@ramky.com
                  </a>
                  .
                </p>
              </CardContent>
            </>
          )}

          {phase === 'error' && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle>Unable to open invitation</CardTitle>
                <CardDescription>{errorMsg}</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground">
                  Please contact{' '}
                  <a href="mailto:vendxsupport@ramky.com" className="text-primary hover:underline">
                    vendxsupport@ramky.com
                  </a>{' '}
                  for help.
                </p>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <footer className="py-4 text-center text-sm text-muted-foreground">
        © 2026 Sharvi Infotech Private Limited. All rights reserved.
      </footer>
    </div>
  );
}
