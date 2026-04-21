import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ramkyLogo from '@/assets/ramky-logo.png';

export default function VendorInviteAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'validating' | 'signing_in' | 'error'>('validating');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!token) {
        setErrorMsg('No invitation token provided. Please use the link from your email.');
        setStatus('error');
        return;
      }

      // If already signed in with the right email, skip straight to registration
      const { data: sessionData } = await supabase.auth.getSession();
      const currentEmail = sessionData.session?.user?.email?.toLowerCase();

      try {
        setStatus('validating');
        const { data, error } = await supabase.functions.invoke('accept-vendor-invite', {
          body: { token, redirectOrigin: window.location.origin },
        });

        if (cancelled) return;

        if (error || !data?.action_link) {
          const code = (data as any)?.code;
          const msg =
            code === 'expired'
              ? 'This invitation link has expired. Please request a new one.'
              : code === 'invalid'
              ? 'Invalid invitation link. Please contact the administrator.'
              : 'We could not verify your invitation. Please try again shortly.';
          setErrorMsg(msg);
          setStatus('error');
          return;
        }

        // If already signed in as the invited user, just go to registration
        if (currentEmail && data.email && currentEmail === String(data.email).toLowerCase()) {
          navigate(`/vendor/registration?token=${encodeURIComponent(token)}`, { replace: true });
          return;
        }

        setStatus('signing_in');
        // Magic link auto-signs in and redirects back to /vendor/registration?token=...
        window.location.href = data.action_link;
      } catch (err) {
        if (cancelled) return;
        console.error('Invite accept failed:', err);
        setErrorMsg('An unexpected error occurred. Please try again.');
        setStatus('error');
      }
    };

    run();
    return () => {
      cancelled = true;
    };
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
          {status !== 'error' ? (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">
                  {status === 'validating' ? 'Verifying your invitation' : 'Signing you in'}
                </CardTitle>
                <CardDescription>
                  {status === 'validating'
                    ? 'Please wait while we validate your invitation link…'
                    : 'Redirecting you to your registration form…'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </>
          ) : (
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
                  <a
                    href="mailto:support@sharviinfotech.com"
                    className="text-primary hover:underline"
                  >
                    support@sharviinfotech.com
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
