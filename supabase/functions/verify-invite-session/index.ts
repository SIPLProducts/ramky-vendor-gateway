import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string") {
      return new Response(JSON.stringify({ error: "Missing token", code: "invalid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Extract the caller's JWT
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) {
      return new Response(
        JSON.stringify({ error: "Not authenticated", code: "not_authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Invalid session", code: "not_authenticated" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const authedEmail = (userData.user.email || "").toLowerCase();

    // Look up the invitation
    const { data: invite, error: lookupErr } = await admin
      .from("vendor_invitations")
      .select("id, email, expires_at, used_at, vendor_id")
      .eq("token", token)
      .maybeSingle();

    if (lookupErr) {
      console.error("invitation lookup failed:", lookupErr);
      return new Response(JSON.stringify({ error: "Lookup failed", code: "lookup_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!invite) {
      return new Response(JSON.stringify({ error: "Invalid invitation", code: "invalid" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Invitation expired", code: "expired" }), {
        status: 410,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const invitedEmail = String(invite.email || "").toLowerCase();
    if (!authedEmail || authedEmail !== invitedEmail) {
      // Someone opened a mailed link but they're signed in as a different user
      try {
        await admin.from("invitation_email_events").insert({
          invitation_id: invite.id,
          email_id: null,
          event_type: "email_mismatch",
          event_data: { authed_email: authedEmail, invited_email: invitedEmail },
        });
      } catch { /* ignore */ }
      return new Response(
        JSON.stringify({ error: "Email mismatch", code: "email_mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invite.used_at) {
      // Already claimed — allow the same user through (they may be refreshing)
      return new Response(
        JSON.stringify({ ok: true, vendor_id: invite.vendor_id, already_used: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Stamp used_at / user_id via existing RPC (runs as invoker; we have a session-scoped client too)
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { error: claimErr } = await userClient.rpc("claim_invitation", { _token: token });
    if (claimErr) {
      console.warn("claim_invitation rpc failed, falling back to admin update:", claimErr);
      await admin
        .from("vendor_invitations")
        .update({ used_at: new Date().toISOString(), user_id: userData.user.id })
        .eq("id", invite.id);
    }

    return new Response(
      JSON.stringify({ ok: true, vendor_id: invite.vendor_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-invite-session error:", err);
    return new Response(JSON.stringify({ error: "Unexpected error", code: "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
