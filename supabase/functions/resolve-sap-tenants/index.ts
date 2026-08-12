import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader) return json({ error: "Missing Authorization bearer token" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Invalid or expired token" }, 401);
    const callerId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    // Same authority as User Management: built-in admin roles, admin-named
    // custom roles, or the user_management screen permission.
    const { data: roleRows } = await admin
      .from("user_roles").select("role").eq("user_id", callerId);
    const builtIn = (roleRows ?? []).map((r: any) => String(r.role).toLowerCase());

    const { data: customRows } = await admin
      .from("user_custom_roles").select("custom_roles(name, is_active)").eq("user_id", callerId);
    const customNames = (customRows ?? [])
      .map((r: any) => r?.custom_roles)
      .filter((cr: any) => cr && cr.is_active)
      .map((cr: any) => String(cr.name || "").toLowerCase());

    let allowed =
      builtIn.some((r) => ["admin", "sharvi_admin", "customer_admin"].includes(r)) ||
      customNames.some((n) => ["admin", "sharvi admin", "customer admin"].includes(n));

    if (!allowed) {
      const { data: permOk } = await admin.rpc("has_screen_permission", {
        _user_id: callerId,
        _screen_key: "user_management",
      });
      allowed = permOk === true;
    }

    if (!allowed) {
      return json({ error: "Forbidden — you do not have permission to manage users/tenants." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const list: { code: string; name?: string }[] = Array.isArray(body?.sap_tenants) ? body.sap_tenants : [];
    const rows = list
      .filter((t) => t && t.code)
      .map((t) => ({ code: String(t.code), name: String(t.name || t.code), is_active: true }));

    if (rows.length === 0) return json({ tenant_ids: [] });

    const { error: upErr } = await admin
      .from("tenants")
      .upsert(rows, { onConflict: "code", ignoreDuplicates: false });
    if (upErr) return json({ error: `Could not save tenants: ${upErr.message}` }, 500);

    const { data: tRows, error: fErr } = await admin
      .from("tenants").select("id, code").in("code", rows.map((r) => r.code));
    if (fErr) return json({ error: `Could not read tenants: ${fErr.message}` }, 500);

    return json({ tenant_ids: (tRows ?? []).map((r: any) => r.id) });
  } catch (e: any) {
    return json({ error: e?.message || "Unexpected error" }, 500);
  }
});
