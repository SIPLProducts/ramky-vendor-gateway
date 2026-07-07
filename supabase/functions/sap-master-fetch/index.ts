import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticatedUser, authErrorResponse } from "../_shared/auth.ts";
import { makeReqId, trace, traceFetch, safePreview, summarizeError } from "../_shared/trace.ts";

const SVC = "sap-master-fetch";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
};

// Map SAP master JSON keys -> our master_type + (codeField, descField)
const MASTER_MAP: Record<string, { type: string; code: string; desc?: string; codeFn?: (item: any) => string | null }> = {
  VENDOR_ACC_GRP:     { type: "vendor_account_group",     code: "KTOKK", desc: "TXT30" },
  COMPANY_CODE:       { type: "company_code",             code: "BUKRS", desc: "BUTXT" },
  PLANNING_GROUP:     { type: "planning_group",           code: "GRUPP" },
  RECON_ACCOUNT:      { type: "recon_account",            code: "SAKNR", desc: "TXT20" },
  PURCHASE_ORG:       { type: "purchase_org",             code: "EKORG", desc: "EKOTX" },
  CURRENCY:           { type: "currency",                 code: "WAERS", desc: "LTEXT" },
  COUNTRY:            { type: "country",                  code: "LAND1", desc: "LANDX" },
  REGION:             {
    type: "region", code: "BLAND", desc: "BEZEI",
    codeFn: (item) => {
      const l = item?.LAND1; const b = item?.BLAND;
      if (l == null || b == null || String(l).trim() === "" || String(b).trim() === "") return null;
      return `${String(l)}_${String(b)}`;
    },
  },
  MAT_GRP_VENDOR:     { type: "material_group_vendor",    code: "ATWRT", desc: "ATWTB" },
  CAT_VENDOR:         { type: "vendor_category",          code: "ATWRT", desc: "ATWTB" },
  LOCATION_VENDOR:    { type: "vendor_location",          code: "ATWRT", desc: "ATWTB" },
  IDENTIFICATION_SOURCE: { type: "identification_source", code: "ATWRT", desc: "ATWTB" },
  CFSTMT:             { type: "vendor_cashflow",          code: "ATWRT", desc: "ATWTB" },
  CP_TIER:            { type: "tier_category",            code: "ATWRT", desc: "ATWTB" },
};

const SAP_KEY_BY_TYPE = Object.fromEntries(
  Object.entries(MASTER_MAP).map(([sapKey, mapping]) => [mapping.type, sapKey]),
) as Record<string, string>;

function normalizeRequestedTypes(body: any): string[] | undefined {
  const raw = body?.master_types ?? body?.master_type;
  if (raw === undefined || raw === null || raw === "") return undefined;
  const values = Array.isArray(raw) ? raw.flat(Infinity) : [raw];
  const normalized = values
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
}

// Which master types belong to which named SAP API config.
const CLASSIFICATION_TYPES = new Set([
  "material_group_vendor",
  "vendor_category",
  "vendor_location",
  "identification_source",
  "vendor_cashflow",
  "tier_category",
]);

const CLASSIFICATION_SAP_KEYS = new Set([
  "MAT_GRP_VENDOR",
  "CAT_VENDOR",
  "LOCATION_VENDOR",
  "IDENTIFICATION_SOURCE",
  "CFSTMT",
  "CP_TIER",
]);

const CONFIG_NAME_CLASSIFICATION = "Classification F4s";
const CONFIG_NAME_GENERAL = "SAP Fields F4";

function ok(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

function parseHostRewrites(): { from: string; to: string }[] {
  return (Deno.env.get("SAP_MIDDLEWARE_HOST_REWRITES") || "")
    .split(",").map((s) => s.trim()).filter(Boolean)
    .map((pair) => { const [f, t] = pair.split("="); return { from: (f || "").trim(), to: (t || "").trim() }; })
    .filter((p) => p.from && p.to);
}
function rewriteContainerHost(u: string): string {
  if (!u) return u;
  try {
    const url = new URL(u);
    const hit = parseHostRewrites().find((r) => r.from === url.hostname);
    if (hit) {
      const from = url.hostname;
      url.hostname = hit.to;
      console.log(JSON.stringify({ svc: "sap-master-fetch", stage: "middleware.url.rewritten", from, to: hit.to, finalUrl: url.toString().replace(/\/+$/, ""), source: "host-rewrite-list" }));
      return url.toString().replace(/\/+$/, "");
    }
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      const from = url.hostname;
      url.hostname = "172.17.0.1";
      console.log(JSON.stringify({ svc: "sap-master-fetch", stage: "middleware.url.rewritten", from, to: "172.17.0.1", finalUrl: url.toString().replace(/\/+$/, ""), source: "loopback" }));
      return url.toString().replace(/\/+$/, "");
    }
  } catch { /* ignore */ }
  return u;
}

function normalizeMiddlewareBase(raw: string): string {
  const override = (Deno.env.get("SAP_MIDDLEWARE_URL_OVERRIDE") || "").trim();
  let v = String(override || raw || "").replace(/\s+/g, "").trim();
  // Repair common scheme typos: "http;//host", "https;//host", "http:/host"
  v = v.replace(/^(https?);\/\//i, "$1://");
  v = v.replace(/^(https?):\/(?!\/)/i, "$1://");
  // If user typed no scheme at all, default to http (self-hosted internal IPs)
  if (!/^https?:\/\//i.test(v) && v.length > 0) {
    v = "http://" + v.replace(/^\/+/, "");
  }
  v = v.replace(/\/+$/, "");
  v = v.replace(/\/sap\/bp\/create$/i, "")
       .replace(/\/sap\/dms\/upload$/i, "")
       .replace(/\/api\/sap\/proxy$/i, "")
       .replace(/\/sap\/proxy$/i, "")
       .replace(/\/health$/i, "")
       .replace(/\/+$/, "");
  return rewriteContainerHost(v);
}

function pickConfig(configs: any[], name: string): any | null {
  if (!configs?.length) return null;
  const exact = configs.find((c) => (c.name || "").trim().toLowerCase() === name.toLowerCase() && c.is_active);
  if (exact) return exact;
  return null;
}

function legacyFindConfig(configs: any[]): any | null {
  if (!configs?.length) return null;
  const byName = configs.find((c) => /f4|master/i.test(c.name || ""));
  if (byName) return byName;
  return configs[0];
}

async function countCachedRows(supabase: any, masterType: string): Promise<number> {
  const { count, error } = await supabase
    .from("sap_master_data")
    .select("id", { count: "exact", head: true })
    .eq("master_type", masterType);
  if (error) throw error;
  return count || 0;
}

async function fetchSapForConfig(
  supabase: any,
  config: any,
  reqId: string,
): Promise<{ sapJson: any | null; error: string | null }> {
  const base = (config.base_url || "").replace(/\/$/, "");
  const path = config.endpoint_path || "";
  const sapUrl = `${base}${path}`;
  if (!sapUrl) {
    return { sapJson: null, error: `${config.name}: base_url + endpoint_path missing.` };
  }

  const { data: creds } = await supabase
    .from("sap_api_credentials").select("*").eq("config_id", config.id).maybeSingle();
  const sapHeaders: Record<string, string> = { "Accept": "application/json" };
  if (config.auth_type === "Basic" && creds?.username) {
    sapHeaders["Authorization"] = `Basic ${btoa(`${creds.username}:${creds.password_encrypted ?? ""}`)}`;
  } else if (config.auth_type === "Bearer" && creds?.password_encrypted) {
    sapHeaders["Authorization"] = `Bearer ${creds.password_encrypted}`;
  }

  const httpMethod = (config.http_method || "GET").toUpperCase();
  const connectionMode = (config.connection_mode || "direct").toLowerCase();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);

  try {
    if (connectionMode === "proxy") {
      const middlewareBase = normalizeMiddlewareBase(config.middleware_url || "");
      const middlewareKey = (config.proxy_secret || "").trim();
      if (!middlewareBase) {
        return { sapJson: null, error: `${config.name}: middleware URL is not configured.` };
      }
      if (!middlewareKey) {
        return { sapJson: null, error: `${config.name}: Proxy Secret is not set.` };
      }
      // Validate URL early so we surface a clean message
      try { new URL(middlewareBase); } catch {
        return { sapJson: null, error: `${config.name}: invalid middleware URL after normalization ("${middlewareBase}"). Original saved value: "${config.middleware_url}".` };
      }

      // Try /sap/proxy first (Node middleware exposed at root, e.g. ngrok or :3002).
      // If that path 404s (nginx not routing it), retry /api/sap/proxy (self-hosted via reverse proxy).
      const proxyPaths = ["/sap/proxy", "/api/sap/proxy"];
      const triedUrls: string[] = [];
      let res: Response | null = null;
      let text = "";
      let proxyUrl = "";

      for (const p of proxyPaths) {
        proxyUrl = `${middlewareBase}${p}`;
        triedUrls.push(proxyUrl);
        const r = await traceFetch(reqId, SVC, proxyUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-middleware-key": middlewareKey,
          },
          body: JSON.stringify({
            url: sapUrl,
            method: httpMethod,
            headers: { Accept: "application/json" },
            useBasicAuth: true,
          }),
          signal: controller.signal,
        }, { label: `proxy[${config.name}]` });
        const body = await r.text();
        // Only fall back on a clear "route not found" signal: 404 or HTML page
        const looksLikeMissingRoute =
          r.status === 404 ||
          /^\s*<(!doctype|html)/i.test(body);
        if (looksLikeMissingRoute && p !== proxyPaths[proxyPaths.length - 1]) {
          continue;
        }
        res = r;
        text = body;
        break;
      }

      if (!res) {
        return { sapJson: null, error: `${config.name}: middleware not reachable at any known path. Tried: ${triedUrls.join(", ")}.` };
      }
      if (!res.ok) {
        let detail = text.slice(0, 400);
        try {
          const j = JSON.parse(text);
          detail = `${j.error || "upstream error"}${j.code ? ` [${j.code}]` : ""}${j.target ? ` -> ${j.target}` : ""}`;
        } catch { /* keep raw */ }
        if (res.status === 401) {
          return { sapJson: null, error: `${config.name}: middleware rejected request (HTTP 401) at ${proxyUrl}. Set MIDDLEWARE_SHARED_SECRET on the middleware to match the Proxy Secret.` };
        }
        return { sapJson: null, error: `${config.name}: middleware HTTP ${res.status} at ${proxyUrl}: ${detail}` };
      }
      let wrapper: any = null;
      try { wrapper = JSON.parse(text); }
      catch { return { sapJson: null, error: `${config.name}: invalid JSON from middleware: ${text.slice(0, 200)}` }; }
      if (wrapper.ok === false) {
        return { sapJson: null, error: `${config.name}: middleware error: ${wrapper.error || JSON.stringify(wrapper).slice(0, 200)}` };
      }
      if (typeof wrapper.sapStatus === "number" && wrapper.sapStatus >= 400) {
        return { sapJson: null, error: `${config.name}: SAP HTTP ${wrapper.sapStatus} via middleware: ${
          typeof wrapper.sapResponse === "string"
            ? wrapper.sapResponse.slice(0, 200)
            : JSON.stringify(wrapper.sapResponse).slice(0, 200)
        }` };
      }
      const inner = wrapper.sapResponse;
      if (typeof inner === "string") {
        try { return { sapJson: JSON.parse(inner), error: null }; }
        catch { return { sapJson: null, error: `${config.name}: SAP response not JSON: ${inner.slice(0, 200)}` }; }
      }
      return { sapJson: inner, error: null };
    } else {
      const res = await traceFetch(reqId, SVC, sapUrl, {
        method: httpMethod,
        headers: sapHeaders,
        signal: controller.signal,
      }, { label: `direct[${config.name}]` });
      const text = await res.text();
      trace(reqId, SVC, "direct.body", { configName: config.name, bytes: text.length, preview: safePreview(text) });
      if (!res.ok) {
        return { sapJson: null, error: `${config.name}: SAP HTTP ${res.status}: ${text.slice(0, 200)}` };
      }
      try { return { sapJson: JSON.parse(text), error: null }; }
      catch { return { sapJson: null, error: `${config.name}: invalid JSON from SAP: ${text.slice(0, 200)}` }; }
    }
  } catch (e: any) {
    trace(reqId, SVC, "fetchSapForConfig.error", { configName: config.name, ...summarizeError(e) });
    return { sapJson: null, error: `${config.name}: could not reach SAP: ${e?.message || e}` };
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const reqId = makeReqId(req);
  const tStart = Date.now();
  trace(reqId, SVC, "req.received", { method: req.method, url: req.url });

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) {
    trace(reqId, SVC, "auth.failed", {});
    return authErrorResponse(auth, corsHeaders);
  }
  trace(reqId, SVC, "auth.ok", { userId: auth.userId });

  try {
    const body = await req.json().catch(() => ({}));
    const requestedTypes = normalizeRequestedTypes(body);
    trace(reqId, SVC, "body.parsed", { requestedTypes: requestedTypes || null });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: configs } = await supabase
      .from("sap_api_configs").select("*").eq("is_active", true);
    const allConfigs = configs || [];

    // Decide which configs to call.
    let needClassification = false;
    let needGeneral = false;
    if (requestedTypes && requestedTypes.length > 0) {
      for (const t of requestedTypes) {
        if (CLASSIFICATION_TYPES.has(t)) needClassification = true;
        else needGeneral = true;
      }
    } else {
      // No specific type requested → refresh both groups.
      needClassification = true;
      needGeneral = true;
    }

    const classificationCfg = pickConfig(allConfigs, CONFIG_NAME_CLASSIFICATION);
    const generalCfg = pickConfig(allConfigs, CONFIG_NAME_GENERAL);

    // Build the list of (config, allowedSapKeys) tuples to execute.
    const runs: { config: any; allowedSapKeys: Set<string> | null; label: string }[] = [];

    if (needClassification && classificationCfg) {
      runs.push({
        config: classificationCfg,
        allowedSapKeys: CLASSIFICATION_SAP_KEYS,
        label: CONFIG_NAME_CLASSIFICATION,
      });
    }
    if (needGeneral && generalCfg) {
      // General config handles everything NOT in classification set.
      const generalKeys = new Set(
        Object.keys(MASTER_MAP).filter((k) => !CLASSIFICATION_SAP_KEYS.has(k)),
      );
      runs.push({ config: generalCfg, allowedSapKeys: generalKeys, label: CONFIG_NAME_GENERAL });
    }

    // Some installations expose COUNTRY/REGION in the Classification F4 endpoint.
    // If those are specifically requested, call Classification F4s as a live fallback too.
    const requestedGeneralSapKeys = new Set(
      (requestedTypes || [])
        .map((t) => SAP_KEY_BY_TYPE[t])
        .filter((k): k is string => !!k && !CLASSIFICATION_SAP_KEYS.has(k)),
    );
    if (requestedGeneralSapKeys.size > 0 && classificationCfg) {
      const alreadyQueued = runs.some((r) => r.config.id === classificationCfg.id && r.label === `${CONFIG_NAME_CLASSIFICATION} fallback`);
      if (!alreadyQueued) {
        runs.push({
          config: classificationCfg,
          allowedSapKeys: requestedGeneralSapKeys,
          label: `${CONFIG_NAME_CLASSIFICATION} fallback`,
        });
      }
    }

    // Fallback: if neither named config exists, use legacy single-config behavior.
    if (runs.length === 0) {
      const legacy = legacyFindConfig(allConfigs);
      if (!legacy) {
        return ok({ success: false, message: "No active SAP API config found." });
      }
      runs.push({ config: legacy, allowedSapKeys: null, label: legacy.name || "SAP" });
    }

    const summary: Record<string, { upserted: number; skipped: number }> = {};
    const sapResponse: Record<string, any[]> = {};
    const errors: string[] = [];
    const now = new Date().toISOString();

    for (const run of runs) {
      trace(reqId, SVC, "run.start", { label: run.label, configId: run.config.id });
      const { sapJson, error } = await fetchSapForConfig(supabase, run.config, reqId);
      trace(reqId, SVC, "run.end", { label: run.label, ok: !error, error });
      if (error || !sapJson) {
        errors.push(error || `${run.label}: empty response.`);
        continue;
      }

      for (const [sapKey, mapping] of Object.entries(MASTER_MAP)) {
        if (run.allowedSapKeys && !run.allowedSapKeys.has(sapKey)) continue;
        if (requestedTypes && !requestedTypes.includes(mapping.type)) continue;
        const arr: any[] = Array.isArray(sapJson?.[sapKey]) ? sapJson[sapKey] : [];
        // Capture raw response slice for UI
        if (!sapResponse[sapKey] || (sapResponse[sapKey].length === 0 && arr.length > 0)) sapResponse[sapKey] = arr;

        let skipped = 0;
        const rows: any[] = [];
        for (const item of arr) {
          const codeRaw = mapping.codeFn ? mapping.codeFn(item) : item?.[mapping.code];
          if (codeRaw === undefined || codeRaw === null || String(codeRaw).trim() === "") {
            skipped++;
            continue;
          }
          const desc = mapping.desc ? (item?.[mapping.desc] ?? null) : null;
          rows.push({
            master_type: mapping.type,
            code: String(codeRaw),
            description: desc == null ? null : String(desc),
            extra: item,
            source: "sap",
            last_synced_at: now,
          });
        }
        // Dedupe by code within this master_type — SAP feeds sometimes return
        // duplicate codes (e.g. recon_account SAKNR), which makes Postgres reject
        // the whole chunk with "ON CONFLICT DO UPDATE command cannot affect row
        // a second time". Keep the last occurrence to preserve SAP ordering.
        const dedupMap = new Map<string, any>();
        for (const r of rows) dedupMap.set(r.code, r);
        const uniqueRows = Array.from(dedupMap.values());
        const removedDupes = rows.length - uniqueRows.length;
        if (removedDupes > 0) {
          skipped += removedDupes;
          trace(reqId, SVC, "dedup", { type: mapping.type, removed: removedDupes });
        }
        let upserted = 0;
        for (let i = 0; i < uniqueRows.length; i += 500) {
          const chunk = uniqueRows.slice(i, i + 500);
          const { error: upErr } = await supabase
            .from("sap_master_data")
            .upsert(chunk, { onConflict: "master_type,code" });
          if (upErr) {
            console.error("bulk upsert error", mapping.type, upErr.message);
            skipped += chunk.length;
          } else {
            upserted += chunk.length;
          }
        }
        const prev = summary[mapping.type] || { upserted: 0, skipped: 0 };
        summary[mapping.type] = {
          upserted: prev.upserted + upserted,
          skipped: prev.skipped + skipped,
        };
      }
    }

    // Ensure all known keys exist in sapResponse (UI may iterate them)
    for (const sapKey of Object.keys(MASTER_MAP)) {
      if (!sapResponse[sapKey]) sapResponse[sapKey] = [];
    }

    const cacheWarnings: string[] = [];
    const emptyRequestedTypes: string[] = [];
    if (requestedTypes && requestedTypes.length > 0) {
      for (const masterType of requestedTypes) {
        const sapKey = SAP_KEY_BY_TYPE[masterType];
        if (!sapKey) continue;
        const sapRows = Array.isArray(sapResponse[sapKey]) ? sapResponse[sapKey] : [];
        const stat = summary[masterType] || { upserted: 0, skipped: 0 };
        if (sapRows.length === 0 && stat.upserted === 0) {
          try {
            const cachedCount = await countCachedRows(supabase, masterType);
            if (cachedCount > 0) {
              cacheWarnings.push(`${masterType}: SAP returned 0 rows; keeping ${cachedCount} cached values available to the app.`);
            } else {
              emptyRequestedTypes.push(`${masterType}: SAP returned 0 rows and no cached values exist.`);
            }
          } catch (e: any) {
            emptyRequestedTypes.push(`${masterType}: SAP returned 0 rows and cache check failed (${e?.message || e}).`);
          }
        }
      }
    }

    if (emptyRequestedTypes.length > 0) {
      trace(reqId, SVC, "response.sent", { success: false, elapsedTotalMs: Date.now() - tStart, emptyRequestedTypes });
      return ok({
        success: false,
        message: emptyRequestedTypes.join(" | "),
        hint: "Check the configured SAP F4 endpoint response for the requested master type. The app can only show cached values when cache rows exist.",
        summary,
        fetched_at: now,
        sap_response: sapResponse,
        warnings: errors.length > 0 ? errors : undefined,
        reqId,
      });
    }

    const anyData = Object.values(summary).some((s) => s.upserted > 0) || cacheWarnings.length > 0;
    if (!anyData && errors.length > 0) {
      trace(reqId, SVC, "response.sent", { success: false, elapsedTotalMs: Date.now() - tStart, errorCount: errors.length });
      return ok({
        success: false,
        message: errors.join(" | "),
        hint: "Check that 'SAP Fields F4' and 'Classification F4s' configs in SAP API Settings have correct middleware URL, Proxy Secret, and HTTP method.",
        reqId,
      });
    }

    trace(reqId, SVC, "response.sent", { success: true, elapsedTotalMs: Date.now() - tStart, summaryKeys: Object.keys(summary) });
    return ok({
      success: true,
      summary,
      fetched_at: now,
      sap_response: sapResponse,
      warnings: [...cacheWarnings, ...errors].length > 0 ? [...cacheWarnings, ...errors] : undefined,
      reqId,
    });
  } catch (e: any) {
    trace(reqId, SVC, "unhandled.error", { ...summarizeError(e), elapsedTotalMs: Date.now() - tStart });
    console.error("sap-master-fetch error:", e?.message || e);
    return ok({ success: false, message: e?.message || "Unexpected error", reqId }, 200);
  }
});
