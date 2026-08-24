import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ramkyLogoAsset from '@/assets/ramky-group-logo.jpg.asset.json';
const ramkyLogo = ramkyLogoAsset.url;

type Phase = 'loading' | 'error';

export default function VendorInviteCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState('Please wait a moment.');

  useEffect(() => {
    if (!token) {
      navigate('/vendor/registration', { replace: true });
      return;
    }

    const target = `/vendor/registration?token=${encodeURIComponent(token)}`;

    // Wait briefly for the Supabase client to hydrate the session from the URL,
    // then bind the invitation to that verified auth user before opening the form.
    let cancelled = false;
    let timeoutId: number | undefined;

    const fail = (text: string) => {
      if (cancelled) return;
      setMessage(text);
      setPhase('error');
    };

    const verifyAndGo = async () => {
      if (cancelled) return;
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.access_token) {
        fail('We could not verify your sign-in session. Please open the invitation again.');
        return;
      }

      const { data, error } = await supabase.functions.invoke('claim-vendor-invite', {
        body: { token, redirectOrigin: window.location.origin, attempt: 2 },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const status = (data as any)?.status;
      if (error && !status) {
        fail(error.message || 'Unable to verify invitation access.');
        return;
      }
      if (status === 'verified' || status === 'already_claimed_same_user') {
        navigate((data as any)?.redirect || target, { replace: true });
        return;
      }
      if (status === 'denied') {
        fail('Access Denied. This invitation belongs to a different email address.');
        return;
      }
      fail((data as any)?.message || 'Unable to verify invitation access.');
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) return verifyAndGo();
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') {
          if (timeoutId) window.clearTimeout(timeoutId);
          verifyAndGo();
        }
      });
      timeoutId = window.setTimeout(() => {
        sub.subscription.unsubscribe();
        fail('We could not verify your sign-in session. Please open the invitation again.');
      }, 4000);
    });

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="h-16 border-b bg-white px-6 flex items-center justify-end">
        <div className="flex items-center gap-3 flex-row-reverse">
          <img src={ramkyLogo} alt="Vypaar Portal" className="h-10 w-auto object-contain" />
          <span className="text-sm font-semibold text-black">Vypaar Portal</span>
        </div>
      </header>
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-xl border-0">
          {phase === 'loading' ? (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">Opening your registration…</CardTitle>
                <CardDescription>{message}</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-7 w-7 text-destructive" />
                </div>
                <CardTitle className="text-2xl text-destructive">Access Denied</CardTitle>
                <CardDescription>{message}</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-6">
                <Button variant="outline" onClick={() => navigate(token ? `/vendor/invite?token=${encodeURIComponent(token)}` : '/vendor/login')}>
                  Open invitation again
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
