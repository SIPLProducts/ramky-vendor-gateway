import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ShieldCheck, Ban, Copy, MailCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ramkyLogo from '@/assets/ramky-logo.png';

type Phase = 'loading' | 'redirecting' | 'verification_sent' | 'denied' | 'error';

interface ErrorDetails {
  message: string;
  code?: string;
  status?: string | number;
  raw?: string;
}

export default function VendorInviteAccept() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [verificationInfo, setVerificationInfo] = useState<{ maskedEmail?: string; sendsRemaining?: number } | null>(null);
  const [attemptKey, setAttemptKey] = useState(0);
  const ranRef = useRef(false);

  useEffect(() => {
    ranRef.current = false;
  }, [attemptKey]);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    (async () => {
      if (!token) {
        setErrorDetails({ message: 'No invitation token provided. Please use the link from your email.' });
        setPhase('error');
        return;
      }

      let attempt = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        attempt += 1;
        try {
          const { data, error } = await supabase.functions.invoke('claim-vendor-invite', {
            body: { token, redirectOrigin: window.location.origin, attempt },
          });

          const d = (data as any) || {};
          const status = d.status;
          const code = d.code;

          if (error && !status) {
            let raw: string | undefined;
            const ctx: any = (error as any).context;
            try {
              if (ctx?.response?.text) raw = await ctx.response.text();
            } catch { /* ignore */ }
            setErrorDetails({
              message: error.message || 'We could not open your invitation.',
              status: ctx?.status,
              raw,
            });
            setPhase('error');
            return;
          }

          if (status === 'claimed' && d.session?.access_token && d.session?.refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: d.session.access_token,
              refresh_token: d.session.refresh_token,
            });
            if (sessionError) {
              setErrorDetails({
                message: 'We could not sign you in from this invitation.',
                code: 'set_session_failed',
                raw: sessionError.message,
              });
              setPhase('error');
              return;
            }
            setPhase('redirecting');
            navigate(d.redirect || `/vendor/registration?token=${encodeURIComponent(token)}`, {
              replace: true,
            });
            return;
          }

          if (status === 'verified') {
            setPhase('redirecting');
            navigate(d.redirect || `/vendor/registration?token=${encodeURIComponent(token)}`, {
              replace: true,
            });
            return;
          }

          if (status === 'already_claimed_same_user') {
            setPhase('redirecting');
            navigate(d.redirect || `/vendor/registration?token=${encodeURIComponent(token)}`, {
              replace: true,
            });
            return;
          }

          if (status === 'signin_ready' && d.token_hash) {
            const { error: verifyError } = await supabase.auth.verifyOtp({
              token_hash: d.token_hash,
              type: (d.otp_type || 'magiclink') as any,
            });
            if (verifyError) {
              setErrorDetails({
                message: 'We could not sign you in from this invitation.',
                code: 'verify_otp_failed',
                raw: verifyError.message,
              });
              setPhase('error');
              return;
            }
            setPhase('redirecting');
            navigate(d.redirect || `/vendor/registration?token=${encodeURIComponent(token)}`, {
              replace: true,
            });
            return;
          }

          if (status === 'pending' && attempt < 4) {
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }

          if (status === 'denied' || code === 'already_used') {
            setPhase('denied');
            return;
          }

          if (status === 'expired' || code === 'expired') {
            setErrorDetails({
              message: 'This invitation link has expired. Please contact the administrator.',
              code,
            });
            setPhase('error');
            return;
          }

          if (status === 'invalid' || code === 'invalid') {
            setErrorDetails({
              message: 'Invalid invitation link. Please contact the administrator.',
              code,
            });
            setPhase('error');
            return;
          }

          const friendly: Record<string, string> = {
            smtp_not_configured: "Email service isn't configured yet. Please contact vendxsupport@ramky.com.",
            smtp_send_failed: "We couldn't send the verification email. Please contact vendxsupport@ramky.com.",
            generate_link_failed: "We couldn't generate your secure link. Please contact vendxsupport@ramky.com.",
            provision_failed: "We couldn't prepare your account. Please contact vendxsupport@ramky.com.",
            rate_limited: 'Too many verification emails were sent. Please try again in an hour.',
            env_missing: 'Server is missing required configuration. Please contact support.',
          };
          const codeKey = code || status;
          setErrorDetails({
            message: (codeKey && friendly[codeKey]) || d.message || 'We could not open your invitation.',
            code: codeKey,
            raw: JSON.stringify(d),
          });
          setPhase('error');
          return;
        } catch (err: any) {
          setErrorDetails({
            message: err?.message || 'An unexpected error occurred.',
            raw: String(err),
          });
          setPhase('error');
          return;
        }
      }
    })();
  }, [token, navigate, attemptKey]);

  const copyDetails = () => {
    if (!errorDetails) return;
    const text = [
      `Message: ${errorDetails.message}`,
      errorDetails.code && `Code: ${errorDetails.code}`,
      errorDetails.status && `HTTP: ${errorDetails.status}`,
      errorDetails.raw && `Raw: ${errorDetails.raw}`,
      token && `Token: ${token}`,
    ].filter(Boolean).join('\n');
    navigator.clipboard?.writeText(text).catch(() => {});
  };

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
                  This invitation was already opened by another device or recipient.
                  For security, only the originally invited vendor can use this link.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground">
                  If you believe this is a mistake, please contact{' '}
                  <a href="mailto:vendxsupport@ramky.com" className="text-primary hover:underline">
                    vendxsupport@ramky.com
                  </a>.
                </p>
              </CardContent>
            </>
          )}

          {phase === 'verification_sent' && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <MailCheck className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">Verification email sent</CardTitle>
                <CardDescription className="pt-2">
                  For security, the registration can only be opened from the originally invited mailbox
                  {verificationInfo?.maskedEmail ? <> ({verificationInfo.maskedEmail})</> : null}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  If you are the invited vendor, please open the latest email and click <strong>Open Registration</strong>.
                  If this invitation was forwarded, you will not receive that verification email and cannot access the form.
                </p>
                {typeof verificationInfo?.sendsRemaining === 'number' && (
                  <p className="text-xs text-muted-foreground">
                    Verification sends remaining this hour: {verificationInfo.sendsRemaining}
                  </p>
                )}
                <Button size="sm" variant="outline" onClick={() => setAttemptKey((k) => k + 1)}>
                  Resend verification
                </Button>
              </CardContent>
            </>
          )}

          {phase === 'error' && errorDetails && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle>Unable to open invitation</CardTitle>
                <CardDescription>{errorDetails.message}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(errorDetails.code || errorDetails.status || errorDetails.raw) && (
                  <div className="rounded-md bg-muted p-3 text-xs font-mono text-left space-y-1 break-all">
                    {errorDetails.code && <div><span className="text-muted-foreground">code:</span> {errorDetails.code}</div>}
                    {errorDetails.status && <div><span className="text-muted-foreground">http:</span> {String(errorDetails.status)}</div>}
                    {errorDetails.raw && <div><span className="text-muted-foreground">raw:</span> {errorDetails.raw.slice(0, 500)}</div>}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button size="sm" variant="outline" onClick={() => setAttemptKey((k) => k + 1)}>
                    Retry
                  </Button>
                  <Button size="sm" variant="outline" onClick={copyDetails}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy details
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground text-center">
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
