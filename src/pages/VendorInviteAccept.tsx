import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertCircle, ShieldCheck, Ban } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ramkyLogo from '@/assets/ramky-logo.png';

type Phase = 'verifying' | 'signing_in' | 'denied' | 'error';

export default function VendorInviteAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [phase, setPhase] = useState<Phase>('verifying');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!token) {
        setErrorMsg('No invitation token provided. Please use the link from your email.');
        setPhase('error');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('accept-vendor-invite', {
          body: { token, redirectOrigin: window.location.origin },
        });

        if (cancelled) return;

        if (error || !data?.action_link) {
          const code = (data as any)?.code;
          if (code === 'already_used' || code === 'email_mismatch') {
            setPhase('denied');
            return;
          }
          const msg =
            code === 'expired'
              ? 'This invitation link has expired. Please request a new one.'
              : code === 'invalid'
              ? 'Invalid invitation link. Please contact the administrator.'
              : code === 'link_failed'
              ? 'We could not create the secure sign-in link. Please contact the administrator.'
              : 'We could not verify your invitation. Please try again shortly.';
          console.error('Invite accept failed:', error || data);
          setErrorMsg(msg);
          setPhase('error');
          return;
        }

        setPhase('signing_in');

        if ((data as any).token_hash && (data as any).otp_type) {
          const { error: vErr } = await supabase.auth.verifyOtp({
            token_hash: (data as any).token_hash,
            type: (data as any).otp_type as 'magiclink',
          });
          if (!vErr) {
            navigate(`/vendor/registration?token=${encodeURIComponent(token)}`, { replace: true });
            return;
          }
          console.warn('verifyOtp failed, falling back to action_link:', vErr);
        }

        try {
          const actionUrl = new URL(String(data.action_link));
          window.location.assign(actionUrl.toString());
        } catch (e) {
          console.error('Invalid invite action link:', data.action_link, e);
          setErrorMsg('The invitation sign-in link is invalid. Please contact the administrator.');
          setPhase('error');
        }
      } catch (err) {
        if (cancelled) return;
        console.error('accept failed:', err);
        setErrorMsg('An unexpected error occurred. Please try again.');
        setPhase('error');
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
          {(phase === 'verifying' || phase === 'signing_in') && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">
                  {phase === 'verifying' ? 'Verifying your invitation' : 'Signing you in'}
                </CardTitle>
                <CardDescription>
                  {phase === 'verifying'
                    ? 'Please wait while we validate your invitation link…'
                    : 'Redirecting you to your registration form…'}
                </CardDescription>
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
                  This invitation link is no longer valid. It may have already been used
                  or forwarded from its original recipient. Only the originally invited
                  vendor can access this link, and only once.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground">
                  If you believe this is a mistake, please contact{' '}
                  <a href="mailto:support@sharviinfotech.com" className="text-primary hover:underline">
                    support@sharviinfotech.com
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
                  <a href="mailto:support@sharviinfotech.com" className="text-primary hover:underline">
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
