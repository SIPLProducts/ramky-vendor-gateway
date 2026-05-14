import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticatedUser, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map SAP master JSON keys -> our master_type + (codeField, descField)
const MASTER_MAP: Record<string, { type: string; code: string; desc?: string }> = {
  VENDOR_ACC_GRP: { type: "vendor_account_group", code: "KTOKK", desc: "TXT30" },
  COMPANY_CODE:   { type: "company_code",        code: "BUKRS", desc: "BUTXT" },
  PLANNING_GROUP: { type: "planning_group",      code: "GRUPP" },
  RECON_ACCOUNT:  { type: "recon_account",       code: "SAKNR", desc: "TXT20" },
  PURCHASE_ORG:   { type: "purchase_org",        code: "EKORG", desc: "EKOTX" },
  CURRENCY:       { type: "currency",            code: "WAERS", desc: "LTEXT" },
};

function ok(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function findConfig(configs: any[]): any | null {
  if (!configs?.length) return null;
  // Prefer one named like "F4" or "Master"
  const byName = configs.find((c) => /f4|master/i.test(c.name || ""));
  if (byName) return byName;
  return configs[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req, [
    "admin", "sharvi_admin", "customer_admin", "finance", "SAP Team",
  ]);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const body = await req.json().catch(() => ({}));
    const requestedTypes: string[] | undefined = Array.isArray(body?.master_types)
      ? body.master_types
      : (body?.master_type ? [body.master_type] : undefined);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: configs } = await supabase
      .from("sap_api_configs").select("*").eq("is_active", true);
    const config = findConfig(configs || []);
    if (!config) return ok({ success: false, message: "No active SAP API config found." }, 200);

    // Build target URL
    const base = (config.base_url || "").replace(/\/$/, "");
    const path = config.endpoint_path || "";
    const directUrl = `${base}${path}`;
    if (!directUrl) {
      return ok({ success: false, message: "SAP config base_url + endpoint_path missing." }, 200);
    }

    // Get credentials (Basic / Bearer)
    const { data: creds } = await supabase
      .from("sap_api_credentials").select("*").eq("config_id", config.id).maybeSingle();
    const headers: Record<string, string> = { "Accept": "application/json" };
    if (config.auth_type === "Basic" && creds?.username) {
      headers["Authorization"] = `Basic ${btoa(`${creds.username}:${creds.password_encrypted ?? ""}`)}`;
    } else if (config.auth_type === "Bearer" && creds?.password_encrypted) {
      headers["Authorization"] = `Bearer ${creds.password_encrypted}`;
    }

    // Try call SAP (direct). If it fails (e.g. internal IP), return graceful message.
    let sapJson: any = null;
    let networkError: string | null = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(directUrl, {
        method: (config.http_method || "GET").toUpperCase(),
        headers,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      if (!res.ok) {
        networkError = `SAP HTTP ${res.status}: ${text.slice(0, 200)}`;
      } else {
        try { sapJson = JSON.parse(text); }
        catch { networkError = `Invalid JSON from SAP: ${text.slice(0, 200)}`; }
      }
    } catch (e: any) {
      networkError = `Could not reach SAP at ${directUrl}: ${e?.message || e}`;
    }

    if (networkError || !sapJson) {
      return ok({
        success: false,
        message: networkError || "Empty response from SAP.",
        hint: "Check the 'SAP Fields F4' config base_url, endpoint_path, and credentials. If SAP sits on an internal network, the cloud function cannot reach it directly — manage values manually in this tab.",
      }, 200);
    }

    // Process each known master block
    const summary: Record<string, { upserted: number; skipped: number }> = {};
    const now = new Date().toISOString();

    for (const [sapKey, mapping] of Object.entries(MASTER_MAP)) {
      if (requestedTypes && !requestedTypes.includes(mapping.type)) continue;
      const arr: any[] = Array.isArray(sapJson?.[sapKey]) ? sapJson[sapKey] : [];
      let upserted = 0;
      let skipped = 0;
      for (const item of arr) {
        const code = item?.[mapping.code];
        if (code === undefined || code === null || String(code).trim() === "") {
          skipped++;
          continue;
        }
        const desc = mapping.desc ? (item?.[mapping.desc] ?? null) : null;
        const { error } = await supabase
          .from("sap_master_data")
          .upsert(
            {
              master_type: mapping.type,
              code: String(code),
              description: desc == null ? null : String(desc),
              extra: item,
              source: "sap",
              last_synced_at: now,
            },
            { onConflict: "master_type,code" },
          );
        if (error) { console.error("upsert error", mapping.type, code, error.message); skipped++; }
        else upserted++;
      }
      summary[mapping.type] = { upserted, skipped };
    }

    return ok({ success: true, summary, fetched_at: now });
  } catch (e: any) {
    console.error("sap-master-fetch error:", e?.message || e);
    return ok({ success: false, message: e?.message || "Unexpected error" }, 200);
  }
});
