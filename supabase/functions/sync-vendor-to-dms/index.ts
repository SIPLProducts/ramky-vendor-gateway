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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req, ['admin', 'sharvi_admin', 'customer_admin', 'finance', 'SAP Team']);
  if (!auth.ok) return authErrorResponse(auth, corsHeaders);

  try {
    const { vendorIds } = await req.json();
    if (!Array.isArray(vendorIds) || vendorIds.length === 0) {
      return ok({ success: false, message: "vendorIds (array) is required", results: [] });
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

    const results: Array<{ vendorId: string; success: boolean; message: string; uploadedCount: number; skipped: string[] }> = [];

    for (const vid of vendorIds) {
      const { data: vendor } = await supabase
        .from("vendors").select("*").eq("id", vid).single();

      if (!vendor) {
        results.push({ vendorId: vid, success: false, message: "Vendor not found", uploadedCount: 0, skipped: [], sap: null });
        continue;
      }

      if (!vendor.sap_vendor_code) {
        results.push({
          vendorId: vid,
          success: false,
          message: "Vendor not yet synced to SAP (missing BP_LIFNR)",
          uploadedCount: 0,
          skipped: [],
          sap: null,
        });
        continue;
      }

      const { data: docs } = await supabase
        .from("vendor_documents")
        .select("document_type, file_name, file_path, file_size")
        .eq("vendor_id", vid);

      const uploads: any[] = [];
      const skipped: string[] = [];
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
        // Each batch keeps total approximate JSON size under BATCH_MAX_BYTES.
        const BATCH_MAX_BYTES = 40 * 1024 * 1024; // ~40MB per request
        const batches: any[][] = [];
        let current: any[] = [];
        let currentBytes = 0;
        for (const u of uploads) {
          // base64 length is the dominant cost; approximate ~1 byte per char
          const sz = (u.FILE?.length || 0) + (u.FILE_PATH?.length || 0) + 64;
          if (current.length > 0 && currentBytes + sz > BATCH_MAX_BYTES) {
            batches.push(current);
            current = [];
            currentBytes = 0;
          }
          current.push(u);
          currentBytes += sz;
        }
        if (current.length > 0) batches.push(current);

        let batchErrors = 0;
        let lastErrorMessage = "";

        for (let i = 0; i < batches.length; i++) {
          const payload = {
            BP_LIFNR: vendor.sap_vendor_code,
            FILE_UPLOAD: batches[i],
          };

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

        if (batchErrors === 0) {
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
        }).eq("id", vid);

        await supabase.from("audit_logs").insert({
          vendor_id: vid,
          user_id: auth.user.id,
          action: "dms_sync",
          details: {
            message,
            uploaded_count: uploads.length,
            skipped,
            sap_vendor_code: vendor.sap_vendor_code,
            sap: sapRow,
          },
        });
      }

      results.push({ vendorId: vid, success, message, uploadedCount: uploads.length, skipped, sap: sapRow });
    }


    const successCount = results.filter(r => r.success).length;
    return ok({
      success: successCount > 0,
      message: `${successCount}/${vendorIds.length} vendor(s) uploaded to DMS`,
      results,
    });
  } catch (error: any) {
    console.error("sync-vendor-to-dms error:", error);
    return ok({ success: false, message: error.message || "Unexpected error", results: [] });
  }
});
