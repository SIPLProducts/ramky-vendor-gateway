import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticatedUser, authErrorResponse } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function ok(body: any) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

const DOC_NAME_MAP: Record<string, string> = {
  pan_card: "pan",
  gst_certificate: "gst",
  gst_self_declaration: "gst_self_declaration",
  msme_certificate: "msme",
  cancelled_cheque: "bank_cheque1",
  cancelled_cheque_2: "bank_cheque2",
  financial_docs: "financials",
  dealership_certificate: "dealership",
  iec_certificate: "iec",
  swift_iban_proof: "swift_iban",
  incorporation_certificate: "incorporation",
  other: "other",
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const DMS_BATCH_MAX_BYTES = 1 * 1024 * 1024; // Keep each middleware request safely below common proxy/parser limits.
const MIN_MIDDLEWARE_BODY_LIMIT_BYTES = 10 * 1024 * 1024;
const MIN_SUPPORTED_MIDDLEWARE_MAJOR = 3;

type DmsResult = {
  BP_LIFNR: string;
  success: boolean;
  message: string;
  uploadedCount: number;
  skipped: string[];
  sap?: any;
  sapRows?: any[];
};

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

function normalizeMiddlewareBase(raw: string): string {
  if (!raw) return "";
  let v = String(raw).replace(/\s+/g, "").trim();
  v = v.replace(/\/+$/, "");
  v = v.replace(/\/sap\/bp\/create$/i, "");
  v = v.replace(/\/sap\/dms\/upload$/i, "");
  v = v.replace(/\/sap\/proxy$/i, "");
  v = v.replace(/\/health$/i, "");
  return v.replace(/\/+$/, "");
}

function estimateUploadBytes(upload: any): number {
  return (upload?.FILE?.length || 0) + (upload?.FILE_PATH?.length || 0) + 96;
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function parseSizeToBytes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = value.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2] || "b";
  const factors: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };
  return Math.floor(n * factors[unit]);
}

function middlewareMajorVersion(version: unknown): number | null {
  if (typeof version !== "string") return null;
  const match = version.match(/dms-large-upload-v(\d+)/i);
  return match ? Number(match[1]) : null;
}

async function checkDmsMiddlewareHealth(middlewareUrl: string): Promise<{ ok: boolean; message: string; health?: any }> {
  const healthUrl = `${middlewareUrl}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(healthUrl, { method: "GET", signal: controller.signal });
    const text = await res.text();
    let health: any = null;
    try { health = JSON.parse(text); } catch { /* non-JSON health response */ }

    if (!res.ok || !health || typeof health !== "object") {
      return { ok: false, message: `Middleware health check failed at /health (HTTP ${res.status}). Please restart the latest middleware before DMS upload.` };
    }

    const major = middlewareMajorVersion(health.middlewareVersion);
    const bodyLimitBytes = parseSizeToBytes(health.bodyLimit);

    if (!major || major < MIN_SUPPORTED_MIDDLEWARE_MAJOR || !bodyLimitBytes) {
      return {
        ok: false,
        health,
        message: `Old middleware is running. /health must show middlewareVersion dms-large-upload-v${MIN_SUPPORTED_MIDDLEWARE_MAJOR}+ and bodyLimit. Current: ${JSON.stringify({ middlewareVersion: health.middlewareVersion, bodyLimit: health.bodyLimit })}`,
      };
    }

    if (bodyLimitBytes < MIN_MIDDLEWARE_BODY_LIMIT_BYTES) {
      return {
        ok: false,
        health,
        message: `Middleware body limit is too small for DMS upload (${health.bodyLimit}). Set MIDDLEWARE_BODY_LIMIT=500mb and restart middleware.`,
      };
    }

    return { ok: true, message: "Middleware ready", health };
  } catch (e: any) {
    return { ok: false, message: `Could not reach middleware /health before DMS upload: ${e?.message || "network error"}` };
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req, ['admin', 'sharvi_admin', 'customer_admin', 'finance', 'SAP Team']);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const reqBody = await req.json();
    // Accept three shapes:
    //  A) { vendorIds: string[] } — legacy multi-vendor flow
    //  B) { vendorId, payload: { BP_LIFNR, FILE_UPLOAD } } — previous explicit flow
    //  C) { BP_LIFNR, FILE_UPLOAD } — exact SAP DMS payload visible in browser Inspect
    const directPayload = (reqBody?.BP_LIFNR && Array.isArray(reqBody?.FILE_UPLOAD))
      ? { BP_LIFNR: String(reqBody.BP_LIFNR), FILE_UPLOAD: reqBody.FILE_UPLOAD as any[] }
      : null;
    const wrappedPayload = (reqBody?.payload?.BP_LIFNR && Array.isArray(reqBody?.payload?.FILE_UPLOAD))
      ? { BP_LIFNR: String(reqBody.payload.BP_LIFNR), FILE_UPLOAD: reqBody.payload.FILE_UPLOAD as any[] }
      : null;
    const explicitPayload = directPayload || wrappedPayload;
    const vendorIds: string[] = explicitPayload && reqBody.vendorId
      ? [reqBody.vendorId]
      : (Array.isArray(reqBody?.vendorIds) ? reqBody.vendorIds : []);
    const vendorCodes: string[] = explicitPayload && !reqBody.vendorId ? [explicitPayload.BP_LIFNR] : [];
    const targetCount = vendorIds.length || vendorCodes.length;

    if (targetCount === 0) {
      return ok({ success: false, message: "vendorIds (array), { vendorId, payload }, or direct { BP_LIFNR, FILE_UPLOAD } is required", results: [] });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve middleware target (re-use the same SAP API config)
    const { data: configs } = await supabase
      .from("sap_api_configs").select("*").eq("is_active", true)
      .order("created_at", { ascending: false });
    const config = (configs || [])[0];
    const rawMiddlewareUrl = config?.middleware_url || Deno.env.get("SAP_MIDDLEWARE_URL") || "";
    const middlewareUrl = normalizeMiddlewareBase(rawMiddlewareUrl);
    const middlewareKey = (config?.proxy_secret || Deno.env.get("SAP_MIDDLEWARE_KEY") || "").trim();
    const dmsUrl = middlewareUrl ? `${middlewareUrl}/sap/dms/upload` : "";

    // Health check blocks known-old middleware because it rejects even small DMS JSON payloads.
    const middlewareHealth = middlewareUrl ? await checkDmsMiddlewareHealth(middlewareUrl) : null;
    if (middlewareHealth && !middlewareHealth.ok) {
      return ok({ success: false, message: middlewareHealth.message, results: [] });
    } else if (middlewareHealth?.health) {
      console.log("DMS middleware ready:", JSON.stringify({
        middlewareVersion: middlewareHealth.health.middlewareVersion,
        bodyLimit: middlewareHealth.health.bodyLimit,
        dmsEndpoint: middlewareHealth.health.dmsEndpoint,
      }));
    }

    const results: DmsResult[] = [];

    const targets = vendorIds.length > 0
      ? vendorIds.map((vendorId) => ({ vendorId, BP_LIFNR: null as string | null }))
      : vendorCodes.map((BP_LIFNR) => ({ vendorId: null as string | null, BP_LIFNR }));

    for (const target of targets) {
      const { data: vendor } = await supabase
        .from("vendors").select("*")
        .eq(target.vendorId ? "id" : "sap_vendor_code", target.vendorId || target.BP_LIFNR)
        .single();

      if (!vendor) {
        results.push({ BP_LIFNR: target.BP_LIFNR || "", success: false, message: "Vendor not found for BP_LIFNR", uploadedCount: 0, skipped: [], sap: null });
        continue;
      }

      if (!vendor.sap_vendor_code) {
        results.push({
          BP_LIFNR: vendor.sap_vendor_code || target.BP_LIFNR || "",
          success: false,
          message: "Vendor not yet synced to SAP (missing BP_LIFNR)",
          uploadedCount: 0,
          skipped: [],
          sap: null,
        });
        continue;
      }



      const uploads: any[] = [];
      const skipped: string[] = [];

      if (explicitPayload && explicitPayload.BP_LIFNR === vendor.sap_vendor_code) {
        // Use the payload sent from the browser as-is (already contains base64 + paths).
        for (const item of explicitPayload.FILE_UPLOAD) {
          if (item?.FILE && item?.FILE_PATH) uploads.push({ FILE: item.FILE, FILE_PATH: item.FILE_PATH });
        }
      } else {
        const { data: docs } = await supabase
          .from("vendor_documents")
          .select("document_type, file_name, file_path, file_size")
          .eq("vendor_id", vendor.id);

        for (const d of docs || []) {
          try {
            if (d.file_size && d.file_size > MAX_UPLOAD_BYTES) {
              skipped.push(`${d.file_name} (>10MB)`);
              continue;
            }
            const { data: blob, error: dlErr } = await supabase.storage
              .from("vendor-documents").download(d.file_path);
            if (dlErr || !blob) { skipped.push(`${d.file_name} (download failed)`); continue; }
            const base64 = await blobToBase64(blob);
            uploads.push({ FILE: base64, FILE_PATH: d.file_path });
          } catch (e: any) {
            skipped.push(`${d.file_name} (${e?.message || "error"})`);
          }
        }
      }

      let success = false;
      let message = "";
      let sapRow: any = null;
      const allSapRows: any[] = [];

      if (!dmsUrl) {
        success = true;
        message = `Simulated DMS upload (${uploads.length} document${uploads.length === 1 ? '' : 's'})`;
      } else if (uploads.length === 0) {
        success = false;
        message = "No uploadable documents found for this vendor";
      } else {
        // Split into batches to avoid 413 PayloadTooLarge at the middleware.
        // Each batch keeps total approximate JSON size under DMS_BATCH_MAX_BYTES.
        const batches: any[][] = [];
        let current: any[] = [];
        let currentBytes = 0;
        for (const u of uploads) {
          const sz = estimateUploadBytes(u);
          if (sz > DMS_BATCH_MAX_BYTES) {
            skipped.push(`${u.FILE_PATH || "document"} (${formatMb(sz)} exceeds safe per-request DMS limit ${formatMb(DMS_BATCH_MAX_BYTES)})`);
            continue;
          }
          if (current.length > 0 && currentBytes + sz > DMS_BATCH_MAX_BYTES) {
            batches.push(current);
            current = [];
            currentBytes = 0;
          }
          current.push(u);
          currentBytes += sz;
        }
        if (current.length > 0) batches.push(current);

        if (uploads.length > 0 && batches.length === 0) {
          success = false;
          message = `No documents fit the safe DMS request size of ${formatMb(DMS_BATCH_MAX_BYTES)}. ${skipped.join("; ")}`;
        }

        let batchErrors = 0;
        let lastErrorMessage = "";

        for (let i = 0; i < batches.length; i++) {
          const payload = {
            BP_LIFNR: vendor.sap_vendor_code,
            FILE_UPLOAD: batches[i],
          };
          const payloadBytes = batches[i].reduce((sum, item) => sum + estimateUploadBytes(item), 0);
          console.log(`DMS SAP payload batch ${i + 1}/${batches.length}: BP_LIFNR=${payload.BP_LIFNR} files=${batches[i].length} approx=${formatMb(payloadBytes)} paths=${batches[i].map((x) => x.FILE_PATH).join(", ")}`);

          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 180000);
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (middlewareKey) headers["x-middleware-key"] = middlewareKey;
            const res = await fetch(dmsUrl, {
              method: "POST",
              headers,
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
            clearTimeout(timer);
            const text = await res.text();
            console.log(`DMS batch ${i + 1}/${batches.length} status=${res.status} body=${text.slice(0, 300)}`);

            let inner: any = null;
            try {
              const parsed = JSON.parse(text);
              if (parsed && typeof parsed === "object" && parsed.code === "PAYLOAD_TOO_LARGE") {
                batchErrors++;
                lastErrorMessage = `Middleware rejected batch ${i + 1}: ${parsed.error || "payload too large"}`;
                continue;
              }
              inner = parsed && typeof parsed === "object" && "sapResponse" in parsed
                ? parsed.sapResponse
                : parsed;
            } catch {
              inner = null;
            }

            const rows: any[] = Array.isArray(inner)
              ? inner
              : (inner && typeof inner === "object" ? [inner] : []);
            allSapRows.push(...rows);

            const batchOk = res.ok && rows.length > 0 && rows.every((r: any) => r?.MSGTYP === "S");
            const firstErr = rows.find((r: any) => r?.MSGTYP && r.MSGTYP !== "S");

            if (!batchOk) {
              batchErrors++;
              if (res.ok && firstErr?.MSG) {
                lastErrorMessage = `SAP DMS error (batch ${i + 1}): ${firstErr.MSG}`;
              } else if (!res.ok) {
                lastErrorMessage = `DMS upload failed (HTTP ${res.status}) on batch ${i + 1}: ${text.slice(0, 200)}`;
              } else {
                lastErrorMessage = `SAP DMS returned no success rows on batch ${i + 1}`;
              }
            }
          } catch (e: any) {
            batchErrors++;
            lastErrorMessage = `Could not reach DMS endpoint on batch ${i + 1}: ${e?.message || "network error"}`;
          }
        }

        sapRow = allSapRows.find((r) => r?.MSGTYP === "S") || allSapRows[0] || null;

        if (success === false && batches.length === 0) {
          // Message already set above for oversized single-file cases.
        } else if (batchErrors === 0) {
          success = true;
          message = sapRow?.MSG || `File(s) Uploaded Successfully (${uploads.length} document${uploads.length === 1 ? '' : 's'})`;
        } else {
          success = false;
          message = lastErrorMessage || `DMS upload failed for ${batchErrors}/${batches.length} batch(es)`;
        }
      }

      if (success) {
        await supabase.from("vendors").update({
          status: "dms_synced",
          dms_synced_at: new Date().toISOString(),
        }).eq("id", vendor.id);

        await supabase.from("audit_logs").insert({
          vendor_id: vendor.id,
          user_id: auth.user.id,
          action: "dms_sync",
          details: {
            message,
            uploaded_count: uploads.length,
            skipped,
            sap_vendor_code: vendor.sap_vendor_code,
            sap: sapRow,
            sap_rows: allSapRows,
          },
        });
      }

      results.push({ BP_LIFNR: vendor.sap_vendor_code, success, message, uploadedCount: uploads.length, skipped, sap: sapRow, sapRows: allSapRows });
    }


    const successCount = results.filter(r => r.success).length;
    return ok({
      success: successCount > 0,
      message: `${successCount}/${targetCount} vendor(s) uploaded to DMS`,
      results,
    });
  } catch (error: any) {
    console.error("sync-vendor-to-dms error:", error);
    return ok({ success: false, message: error.message || "Unexpected error", results: [] });
  }
});
