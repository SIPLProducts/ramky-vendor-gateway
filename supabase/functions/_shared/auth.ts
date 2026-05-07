// Shared auth helpers for edge functions.
// Verifies the JWT on the request and (optionally) enforces a role allowlist
// against public.user_roles.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type AuthResult =
  | { ok: true; userId: string; email: string | null; roles: string[] }
  | { ok: false; status: number; message: string };

export async function requireAuthenticatedUser(
  req: Request,
  allowedRoles?: string[],
): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return { ok: false, status: 401, message: "Missing Authorization bearer token" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, message: "Invalid or expired token" };
  }
  const user = userData.user;

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: roleRows } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  const baseRoles = (roleRows ?? []).map((r: { role: string }) => r.role);

  // Also load custom-role names so allowlists can match them transparently.
  const { data: customRows } = await adminClient
    .from("user_custom_roles")
    .select("custom_roles(name)")
    .eq("user_id", user.id);
  const customRoleNames = (customRows ?? [])
    .map((r: any) => r?.custom_roles?.name)
    .filter((n: any) => typeof n === "string" && n.length > 0);

  const roles = [...baseRoles, ...customRoleNames];

  if (allowedRoles && allowedRoles.length > 0) {
    const ok = roles.some((r) => allowedRoles.includes(r));
    if (!ok) {
      return { ok: false, status: 403, message: "Forbidden — insufficient role" };
    }
  }

  return { ok: true, userId: user.id, email: user.email ?? null, roles };
}

export function authErrorResponse(
  result: Extract<AuthResult, { ok: false }>,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ error: result.message }),
    { status: result.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
