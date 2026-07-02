import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, ShieldCheck, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ramkyLogo from "@/assets/ramky-logo.png";

type Phase = "waiting_session" | "verifying" | "denied" | "error";

export default function VendorInviteCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [phase, setPhase] = useState<Phase>("waiting_session");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErrorMsg("Missing invitation token.");
      setPhase("error");
      return;
    }

    let cancelled = false;
    let unsub: (() => void) | null = null;

    const verify = async () => {
      if (cancelled) return;
      setPhase("verifying");
      try {
        const { data, error } = await supabase.functions.invoke("verify-invite-session", {
          body: { token },
        });
        if (cancelled) return;

        const code = (data as any)?.code;
        if (error || !(data as any)?.ok) {
          if (code === "email_mismatch") {
            try { await supabase.auth.signOut(); } catch { /* ignore */ }
            setPhase("denied");
            return;
          }
          if (code === "expired") {
            setErrorMsg("This invitation link has expired. Please request a new one.");
          } else if (code === "invalid") {
            setErrorMsg("Invalid invitation link. Please contact the administrator.");
          } else if (code === "not_authenticated") {
            setErrorMsg("Sign-in did not complete. Please open the link from your inbox again.");
          } else {
            setErrorMsg("We could not verify your invitation. Please try again shortly.");
          }
          setPhase("error");
          return;
        }
        navigate(`/vendor/registration?token=${encodeURIComponent(token)}`, { replace: true });
      } catch (e) {
        if (cancelled) return;
        console.error("verify-invite-session failed:", e);
        setErrorMsg("An unexpected error occurred. Please try again.");
        setPhase("error");
      }
    };

    // If session is already present, verify immediately; otherwise wait for SIGNED_IN.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        verify();
      } else {
        const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_IN" && session) verify();
        });
        unsub = () => sub.subscription.unsubscribe();
        // Safety timeout
        setTimeout(() => {
          if (!cancelled && phase === "waiting_session") {
            setErrorMsg("Sign-in did not complete. Please open the link from your inbox again.");
            setPhase("error");
          }
        }, 15000);
      }
    });

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
          {(phase === "waiting_session" || phase === "verifying") && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-7 w-7 text-primary" />
                </div>
                <CardTitle className="text-2xl">
                  {phase === "waiting_session" ? "Completing sign-in" : "Verifying your access"}
                </CardTitle>
                <CardDescription>
                  {phase === "waiting_session"
                    ? "Finishing the secure sign-in from your inbox…"
                    : "Confirming your invitation…"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </>
          )}

          {phase === "denied" && (
            <>
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
                  <Ban className="h-7 w-7 text-destructive" />
                </div>
                <CardTitle className="text-2xl text-destructive">Access Denied</CardTitle>
                <CardDescription className="pt-2">
                  This invitation is bound to a specific email address. The account you are
                  signed in with does not match the originally invited recipient.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground">
                  If you believe this is a mistake, please contact{" "}
                  <a href="mailto:support@sharviinfotech.com" className="text-primary hover:underline">
                    support@sharviinfotech.com
                  </a>
                  .
                </p>
              </CardContent>
            </>
          )}

          {phase === "error" && (
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
                  Please contact{" "}
                  <a href="mailto:support@sharviinfotech.com" className="text-primary hover:underline">
                    support@sharviinfotech.com
                  </a>{" "}
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
