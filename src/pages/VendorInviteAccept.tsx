import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, ShieldCheck, Ban, Mail } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ramkyLogo from '@/assets/ramky-logo.png';

type Phase = 'loading' | 'confirm_email' | 'sending' | 'sent' | 'denied' | 'error';

export default function VendorInviteAccept() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [maskedEmail, setMaskedEmail] = useState<string>('');
  const [emailInput, setEmailInput] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const confirmedEmailRef = useRef<string>('');
  const ranRef = useRef(false);

  // Load invitation summary (masked email + status)
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
        const { data, error } = await supabase.functions.invoke('get-invitation-summary', {
          body: { token },
        });
        if (error || !data) {
          setErrorMsg('Invalid invitation link. Please contact the administrator.');
          setPhase('error');
          return;
        }
        const d = data as any;
        if (d.code === 'invalid') {
          setErrorMsg('Invalid invitation link. Please contact the administrator.');
          setPhase('error');
          return;
        }
        if (d.used || d.expired) {
          setPhase('denied');
          return;
        }
        setMaskedEmail(d.masked_email || '');
        setPhase('confirm_email');
      } catch (err) {
        console.error('get-invitation-summary failed:', err);
        setErrorMsg('An unexpected error occurred. Please try again.');
        setPhase('error');
      }
    })();
  }, [token]);

  const handleConfirmEmail = async () => {
    if (!token || !emailInput.trim()) return;
    setConfirming(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-invite-email', {
        body: { token, email: emailInput.trim() },
      });
      const d = (data as any) || {};
      if (error && !d.code) {
        setErrorMsg('We could not verify your email. Please try again shortly.');
        setPhase('error');
        return;
      }
      if (d.ok) {
        confirmedEmailRef.current = emailInput.trim();
        await requestLink(false);
        return;
      }
      if (d.code === 'email_mismatch') {
        setPhase('denied');
        return;
      }
      if (d.code === 'expired' || d.code === 'used') {
        setPhase('denied');
        return;
      }
      if (d.code === 'rate_limited') {
        setErrorMsg('Too many attempts. Please try again in 15 minutes.');
        setPhase('error');
        return;
      }
      setErrorMsg('Invalid invitation link. Please contact the administrator.');
      setPhase('error');
    } catch (err) {
      console.error('verify-invite-email failed:', err);
      setErrorMsg('An unexpected error occurred. Please try again.');
      setPhase('error');
    } finally {
      setConfirming(false);
    }
  };

  const requestLink = async (isResend = false) => {
    if (!token || !confirmedEmailRef.current) return;
    if (isResend) setResending(true);
    else setPhase('sending');
    try {
      const { data, error } = await supabase.functions.invoke('send-invite-signin-link', {
        body: {
          token,
          confirmed_email: confirmedEmailRef.current,
          redirectOrigin: window.location.origin,
        },
      });
      const code = (data as any)?.code;
      if (error || !(data as any)?.ok) {
        if (code === 'already_used' || code === 'email_mismatch') {
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
      setMaskedEmail((data as any).masked_email || maskedEmail);
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
          {(phase === 'loading' || phase === 'sending') && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">
                  {phase === 'sending' ? 'Sending your sign-in link' : 'Verifying your invitation'}
                </CardTitle>
                <CardDescription>Please wait…</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </>
          )}

          {phase === 'confirm_email' && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">Confirm your email</CardTitle>
                <CardDescription className="pt-2">
                  For security, please enter the email address this invitation was sent to.
                  {maskedEmail ? (
                    <> Hint: <strong className="text-foreground">{maskedEmail}</strong></>
                  ) : null}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    autoFocus
                    placeholder="you@example.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && emailInput.trim() && !confirming) handleConfirmEmail();
                    }}
                    disabled={confirming}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={!emailInput.trim() || confirming}
                  onClick={handleConfirmEmail}
                >
                  {confirming ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>
                  ) : (
                    'Continue'
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Only the originally invited email address can proceed. Forwarded links cannot
                  be used by anyone else.
                </p>
                <p className="text-sm text-muted-foreground text-center">
                  Need help?{' '}
                  <a href="mailto:support@sharviinfotech.com" className="text-primary hover:underline">
                    support@sharviinfotech.com
                  </a>
                </p>
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
                  We've sent a one-time sign-in link to
                  {maskedEmail ? (
                    <> <strong className="text-foreground">{maskedEmail}</strong></>
                  ) : ' your inbox'}
                  . Open that email and click the button to continue your vendor registration.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <p className="text-xs text-muted-foreground">
                  Only the original recipient can complete sign-in.
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
                  This invitation cannot be opened. It may have expired, already been used,
                  or the email address does not match the original recipient. Only the
                  originally invited vendor can access this link.
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
