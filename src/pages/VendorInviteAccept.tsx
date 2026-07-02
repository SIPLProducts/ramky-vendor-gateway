import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ShieldCheck, Ban, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ramkyLogo from '@/assets/ramky-logo.png';

type Phase = 'verifying' | 'sent' | 'denied' | 'error';

export default function VendorInviteAccept() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [phase, setPhase] = useState<Phase>('verifying');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string>('');
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const ranRef = useRef(false);

  const requestLink = async (isResend = false) => {
    if (!token) {
      setErrorMsg('No invitation token provided. Please use the link from your email.');
      setPhase('error');
      return;
    }
    if (isResend) setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-invite-signin-link', {
        body: { token, redirectOrigin: window.location.origin },
      });
      const code = (data as any)?.code;
      if (error || !(data as any)?.ok) {
        if (code === 'already_used') {
          setPhase('denied');
          return;
        }
        if (code === 'expired') {
          setErrorMsg('This invitation link has expired. Please request a new one.');
        } else if (code === 'invalid') {
          setErrorMsg('Invalid invitation link. Please contact the administrator.');
        } else if (code === 'rate_limited') {
          setErrorMsg('Too many sign-in attempts. Please try again in an hour.');
        } else if (code === 'smtp_missing') {
          setErrorMsg('Email service is not configured. Please contact the administrator.');
        } else if (code === 'link_failed') {
          setErrorMsg('We could not create the secure sign-in link. Please contact the administrator.');
        } else {
          setErrorMsg('We could not send your sign-in link. Please try again shortly.');
        }
        setPhase('error');
        return;
      }
      setMaskedEmail((data as any).masked_email || '');
      setPhase('sent');
      setCooldown(30);
    } catch (err) {
      console.error('send-invite-signin-link failed:', err);
      setErrorMsg('An unexpected error occurred. Please try again.');
      setPhase('error');
    } finally {
      if (isResend) setResending(false);
    }
  };

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    requestLink(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

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
          {phase === 'verifying' && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">Verifying your invitation</CardTitle>
                <CardDescription>Please wait while we prepare your secure sign-in link…</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </>
          )}

          {phase === 'sent' && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">Check your inbox</CardTitle>
                <CardDescription className="pt-2">
                  For security, we've sent a one-time sign-in link to the invited email address
                  {maskedEmail ? (
                    <> — <strong className="text-foreground">{maskedEmail}</strong></>
                  ) : null}
                  . Open that email and click the button to continue your vendor registration.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-xs text-muted-foreground">
                  Only the original recipient can complete sign-in. Forwarded links cannot be opened by anyone else.
                </p>
                <Button
                  variant="outline"
                  disabled={cooldown > 0 || resending}
                  onClick={() => requestLink(true)}
                >
                  {resending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resending…</>
                  ) : cooldown > 0 ? (
                    `Resend link (${cooldown}s)`
                  ) : (
                    'Resend link'
                  )}
                </Button>
                <p className="text-sm text-muted-foreground">
                  Need help?{' '}
                  <a href="mailto:support@sharviinfotech.com" className="text-primary hover:underline">
                    support@sharviinfotech.com
                  </a>
                </p>
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
