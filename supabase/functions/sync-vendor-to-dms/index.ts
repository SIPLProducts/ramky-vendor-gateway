import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuthenticatedUser, authErrorResponse } from "../_shared/auth.ts";
import { makeReqId, trace, traceFetch, safePreview, summarizeError } from "../_shared/trace.ts";

const SVC = "sync-vendor-to-dms";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
};

const DMS_PATH_PREFIX = "C:/Users/ADMIN/OneDrive/Desktop/";
function toDmsPath(storagePath: string): string {
  const p = storagePath || "";
  if (p.startsWith(DMS_PATH_PREFIX)) return p;
  const parts = p.split("/");
  const rest = parts.length > 1 ? parts.slice(1).join("/") : parts.join("/");
  return DMS_PATH_PREFIX + rest;
}

function ok(body: any) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

const DMS_CANDIDATE_PATHS = ["/sap/dms/upload", "/sap/bp/create"];

type DocumentFailure = {
  fileName?: string | null;
  filePath?: string | null;
  status?: number;
  url?: string;
  message: string;
};

type DmsResult = {
  BP_LIFNR: string;
  success: boolean;
  message: string;
  attemptedCount: number;
  uploadedCount: number;
  failedCount: number;
  skipped: string[];
  failedDocuments: DocumentFailure[];
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
      console.log(JSON.stringify({ svc: "sync-vendor-to-dms", stage: "middleware.url.rewritten", from, to: hit.to, finalUrl: url.toString().replace(/\/+$/, ""), source: "host-rewrite-list" }));
      return url.toString().replace(/\/+$/, "");
    }
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
      const from = url.hostname;
      url.hostname = "172.17.0.1";
      console.log(JSON.stringify({ svc: "sync-vendor-to-dms", stage: "middleware.url.rewritten", from, to: "172.17.0.1", finalUrl: url.toString().replace(/\/+$/, ""), source: "loopback" }));
      return url.toString().replace(/\/+$/, "");
    }
  } catch { /* ignore */ }
  return u;
}

function normalizeMiddlewareBase(raw: string): string {
  const override = (Deno.env.get("SAP_MIDDLEWARE_URL_OVERRIDE") || "").trim();
  const source = override || raw;
  if (!source) return "";
  let v = String(source).replace(/\s+/g, "").trim();
  v = v.replace(/\/+$/, "");
  v = v.replace(/\/sap\/bp\/create$/i, "");
  v = v.replace(/\/sap\/dms\/upload$/i, "");
  v = v.replace(/\/sap\/proxy$/i, "");
  v = v.replace(/\/health$/i, "");
  return rewriteContainerHost(v.replace(/\/+$/, ""));
}

function estimateUploadBytes(upload: any): number {
  return (upload?.FILE?.length || 0) + (upload?.FILE_PATH?.length || 0) + 96;
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function probeDmsMiddlewareHealth(middlewareUrl: string): Promise<{ health: any; error?: string }> {
  const healthUrl = `${middlewareUrl}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(healthUrl, { method: "GET", signal: controller.signal });
    const text = await res.text();
    let health: any = null;
    try { health = JSON.parse(text); } catch { /* non-JSON */ }
    return { health };
  } catch (e: any) {
    return { health: null, error: e?.message || "network error" };
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const reqId = makeReqId(req);
  const tStart = Date.now();
  trace(reqId, SVC, "req.received", { method: req.method, url: req.url });

  const auth = await requireAuthenticatedUser(req, ['admin', 'sharvi_admin', 'customer_admin', 'finance', 'SAP Team']);
  if (!auth.ok) {
    trace(reqId, SVC, "auth.failed", {});
    return authErrorResponse(auth, corsHeaders);
  }
  trace(reqId, SVC, "auth.ok", { userId: auth.userId });

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
    // Build dynamic candidate endpoint list. Prefer the path advertised by /health if any.
    const middlewareHealth = middlewareUrl ? await probeDmsMiddlewareHealth(middlewareUrl) : null;
    if (middlewareHealth) {
      console.log("DMS middleware health probe:", JSON.stringify(middlewareHealth));
    }
    // Prefer the explicit DMS endpoint. /sap/bp/create remains only as a
    // compatibility fallback for older middleware deployments.
    const healthDmsPath: string | null = (middlewareHealth?.health?.dmsEndpoint && typeof middlewareHealth.health.dmsEndpoint === "string")
      ? middlewareHealth.health.dmsEndpoint
      : null;
    const candidatePaths = Array.from(new Set([
      ...DMS_CANDIDATE_PATHS,
      ...(healthDmsPath ? [healthDmsPath] : []),
    ]));
    const dmsCandidateUrls = middlewareUrl ? candidatePaths.map((p) => `${middlewareUrl}${p.startsWith("/") ? p : `/${p}`}`) : [];
    const dmsUrl = dmsCandidateUrls[0] || "";

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
        results.push({
          BP_LIFNR: target.BP_LIFNR || "",
          success: false,
          message: "Vendor not found for BP_LIFNR",
          attemptedCount: 0,
          uploadedCount: 0,
          failedCount: 0,
          skipped: [],
          failedDocuments: [],
          sap: null,
        });
        continue;
      }

      if (!vendor.sap_vendor_code) {
        results.push({
          BP_LIFNR: vendor.sap_vendor_code || target.BP_LIFNR || "",
          success: false,
          message: "Vendor not yet synced to SAP (missing BP_LIFNR)",
          attemptedCount: 0,
          uploadedCount: 0,
          failedCount: 0,
          skipped: [],
          failedDocuments: [],
          sap: null,
        });
        continue;
      }



      const documents: any[] = [];
      const skipped: string[] = [];
      const failedDocuments: DocumentFailure[] = [];

      if (explicitPayload && explicitPayload.BP_LIFNR === vendor.sap_vendor_code) {
        // Backward-compatible support for direct SAP-shaped payloads. The main
        // portal flow now sends only vendorIds so large base64 never travels
        // through the browser-to-function request path.
        for (let index = 0; index < explicitPayload.FILE_UPLOAD.length; index++) {
          const item = explicitPayload.FILE_UPLOAD[index];
          if (item?.FILE && item?.FILE_PATH) {
            documents.push({
              source: "payload",
              fileBase64: item.FILE,
              filePath: toDmsPath(item.FILE_PATH),
              fileName: item.FILE_NAME || item.fileName || `payload-document-${index + 1}`,
            });
          } else {
            skipped.push(`payload document ${index + 1} (missing FILE or FILE_PATH)`);
          }
        }
      } else {
        const { data: docs, error: docsErr } = await supabase
          .from("vendor_documents")
          .select("document_type, file_name, file_path, file_size")
          .eq("vendor_id", vendor.id);

        if (docsErr) {
          skipped.push(`documents lookup failed (${docsErr.message})`);
        }

        for (const d of docs || []) {
          if (!d.file_path) {
            skipped.push(`${d.file_name || "document"} (missing file path)`);
            continue;
          }
          documents.push({
            source: "storage",
            fileName: d.file_name,
            filePath: toDmsPath(d.file_path),
            storagePath: d.file_path,
            documentType: d.document_type,
          });
        }
      }

      let success = false;
      let message = "";
      let sapRow: any = null;
      const allSapRows: any[] = [];
      let attemptedCount = documents.length;
      let uploadedCount = 0;

      if (!dmsUrl) {
        success = true;
        uploadedCount = attemptedCount;
        message = `Simulated DMS upload (${attemptedCount} document${attemptedCount === 1 ? '' : 's'})`;
      } else if (attemptedCount === 0) {
        success = false;
        message = "No uploadable documents found for this vendor";
      } else {
        let documentErrors = 0;
        let lastErrorMessage = "";
        let workingDmsUrl: string | null = null;

        for (let i = 0; i < documents.length; i++) {
          const doc = documents[i];
          let fileBase64 = doc.fileBase64 as string | undefined;
          const filePath = toDmsPath(doc.filePath || doc.storagePath || "");
          const fileName = doc.fileName || filePath || `document-${i + 1}`;

          if (!fileBase64 && doc.storagePath) {
            try {
              const { data: blob, error: dlErr } = await supabase.storage
                .from("vendor-documents")
                .download(doc.storagePath);
              if (dlErr || !blob) {
                const failure = `${fileName} (download failed${dlErr?.message ? `: ${dlErr.message}` : ""})`;
                skipped.push(failure);
                failedDocuments.push({ fileName, filePath, message: failure });
                documentErrors++;
                continue;
              }
              fileBase64 = await blobToBase64(blob);
            } catch (e: any) {
              const failure = `${fileName} (${e?.message || "download error"})`;
              skipped.push(failure);
              failedDocuments.push({ fileName, filePath, message: failure });
              documentErrors++;
              continue;
            }
          }

          if (!fileBase64 || !filePath) {
            const failure = `${fileName} (missing file content or path)`;
            skipped.push(failure);
            failedDocuments.push({ fileName, filePath, message: failure });
            documentErrors++;
            continue;
          }

          const upload = { FILE: fileBase64, FILE_PATH: filePath };
          const payload = { BP_LIFNR: vendor.sap_vendor_code, FILE_UPLOAD: [upload] };
          const payloadBytes = estimateUploadBytes(upload);
          console.log(`DMS SAP payload document ${i + 1}/${documents.length}: BP_LIFNR=${payload.BP_LIFNR} file=${fileName} approx=${formatMb(payloadBytes)} path=${filePath}`);

          try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (middlewareKey) headers["x-middleware-key"] = middlewareKey;
            const bodyStr = JSON.stringify(payload);

            // Try each candidate path until one responds with non-404. Stick to the first working one for subsequent batches.
            const urlsToTry = workingDmsUrl ? [workingDmsUrl] : [...dmsCandidateUrls];
            let res: Response | null = null;
            let text = "";
            const triedDetails: string[] = [];
            for (const url of urlsToTry) {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 180000);
              try {
                const r = await traceFetch(reqId, SVC, url, {
                  method: "POST",
                  headers,
                  body: bodyStr,
                  signal: controller.signal,
                }, { label: `dms-document-${i + 1}` });
                clearTimeout(timer);
                const t = await r.text();
                trace(reqId, SVC, "dms-document.body", { document: i + 1, fileName, filePath, url, status: r.status, bytes: t.length, preview: safePreview(t) });
                console.log(`DMS document ${i + 1}/${documents.length} url=${url} status=${r.status} body=${t.slice(0, 200)}`);
                if (r.status === 404 && !workingDmsUrl) {
                  triedDetails.push(`${url}->404`);
                  continue;
                }
                res = r;
                text = t;
                workingDmsUrl = url;
                break;
              } catch (e: any) {
                clearTimeout(timer);
                trace(reqId, SVC, "dms-document.error", { document: i + 1, fileName, filePath, url, ...summarizeError(e) });
                triedDetails.push(`${url}->${e?.message || "network error"}`);
              }
            }

            if (!res) {
              documentErrors++;
              lastErrorMessage = `Could not reach a working DMS endpoint for ${fileName}. Tried: ${triedDetails.join("; ")}`;
              failedDocuments.push({ fileName, filePath, message: lastErrorMessage });
              continue;
            }

            let inner: any = null;
            let middlewareEnvelope: any = null;
            try {
              const parsed = JSON.parse(text);
              if (parsed && typeof parsed === "object" && parsed.code === "PAYLOAD_TOO_LARGE") {
                documentErrors++;
                lastErrorMessage = `Middleware rejected ${fileName}: ${parsed.error || "payload too large"}`;
                failedDocuments.push({ fileName, filePath, status: res.status, url: workingDmsUrl || undefined, message: lastErrorMessage });
                continue;
              }
              middlewareEnvelope = parsed && typeof parsed === "object" && "sapResponse" in parsed
                ? parsed
                : null;
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

            const upstreamOk = middlewareEnvelope ? middlewareEnvelope.ok !== false : res.ok;
            const effectiveStatus = middlewareEnvelope?.sapStatus || res.status;
            const batchOk = res.ok && upstreamOk && rows.length > 0 && rows.every((r: any) => r?.MSGTYP === "S");
            const firstErr = rows.find((r: any) => r?.MSGTYP && r.MSGTYP !== "S");

            if (batchOk) {
              uploadedCount += rows.filter((r: any) => r?.MSGTYP === "S").length;
            } else {
              documentErrors++;
              if (res.ok && firstErr?.MSG) {
                lastErrorMessage = `SAP DMS error for ${fileName}: ${firstErr.MSG}`;
              } else if (!res.ok || !upstreamOk) {
                const preview = typeof inner === "string" ? inner.slice(0, 200) : text.slice(0, 200);
                lastErrorMessage = `DMS upload failed (HTTP ${effectiveStatus}) for ${fileName}: ${preview}`;
              } else {
                lastErrorMessage = `SAP DMS returned no success rows for ${fileName}`;
              }
              failedDocuments.push({ fileName, filePath, status: effectiveStatus, url: workingDmsUrl || undefined, message: lastErrorMessage });
            }
          } catch (e: any) {
            documentErrors++;
            lastErrorMessage = `Could not reach DMS endpoint for ${fileName}: ${e?.message || "network error"}`;
            failedDocuments.push({ fileName, filePath, message: lastErrorMessage });
          }
        }

        sapRow = allSapRows.find((r) => r?.MSGTYP === "S") || allSapRows[0] || null;

        if (documentErrors === 0) {
          success = true;
          message = sapRow?.MSG || `File(s) Uploaded Successfully (${uploadedCount} document${uploadedCount === 1 ? '' : 's'})`;
        } else {
          success = false;
          message = `${uploadedCount}/${attemptedCount} document(s) uploaded to DMS${lastErrorMessage ? `: ${lastErrorMessage}` : ""}`;
        }
      }

      if (success) {
        await supabase.from("vendors").update({
          status: "dms_synced",
          dms_synced_at: new Date().toISOString(),
        }).eq("id", vendor.id);

        await supabase.from("audit_logs").insert({
          vendor_id: vendor.id,
          user_id: auth.userId,
          action: "dms_sync",
          details: {
            message,
            attempted_count: attemptedCount,
            uploaded_count: uploadedCount,
            failed_count: failedDocuments.length,
            skipped,
            failed_documents: failedDocuments,
            sap_vendor_code: vendor.sap_vendor_code,
            sap: sapRow,
            sap_rows: allSapRows,
          },
        });
      }

      results.push({
        BP_LIFNR: vendor.sap_vendor_code,
        success,
        message,
        attemptedCount,
        uploadedCount,
        failedCount: failedDocuments.length,
        skipped,
        failedDocuments,
        sap: sapRow,
        sapRows: allSapRows,
      });
    }


    const successCount = results.filter(r => r.success).length;
    trace(reqId, SVC, "response.sent", {
      success: successCount > 0,
      successCount,
      targetCount,
      elapsedTotalMs: Date.now() - tStart,
    });
    return ok({
      success: successCount > 0,
      message: `${successCount}/${targetCount} vendor(s) uploaded to DMS`,
      results,
      reqId,
    });
  } catch (error: any) {
    trace(reqId, SVC, "unhandled.error", { ...summarizeError(error), elapsedTotalMs: Date.now() - tStart });
    console.error("sync-vendor-to-dms error:", error);
    return ok({ success: false, message: error.message || "Unexpected error", results: [], reqId });
  }
});
