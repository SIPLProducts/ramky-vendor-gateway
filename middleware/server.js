/**
 * Sharvi Vendor Portal — SAP Middleware
 * -------------------------------------
 * Runs inside the customer's network. Receives HTTPS calls from the
 * Lovable Cloud Edge Function (sync-vendor-to-sap), authenticates them
 * via a shared secret, then forwards the payload to the internal SAP
 * Business Partner API (e.g. http://10.200.1.2:8000/vendor/bp/create).
 *
 * SAP credentials never leave the customer's network.
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { Agent, setGlobalDispatcher, fetch: undiciFetch } = require("undici");

const PORT = parseInt(process.env.PORT || "3002", 10);
const SHARED_SECRET = process.env.MIDDLEWARE_SHARED_SECRET || "";
const SAP_BP_API_URL = process.env.SAP_BP_API_URL || "";
const SAP_DMS_API_URL = process.env.SAP_DMS_API_URL || SAP_BP_API_URL;
const SAP_BP_USERNAME = process.env.SAP_BP_USERNAME || "";
const SAP_BP_PASSWORD = process.env.SAP_BP_PASSWORD || "";
const TIMEOUT_MS = parseInt(process.env.SAP_REQUEST_TIMEOUT_MS || "30000", 10);
const CONNECT_TIMEOUT_MS = parseInt(process.env.SAP_CONNECT_TIMEOUT_MS || "60000", 10);
const HEADERS_TIMEOUT_MS = parseInt(process.env.SAP_HEADERS_TIMEOUT_MS || "60000", 10);
const BODY_TIMEOUT_MS = parseInt(process.env.SAP_BODY_TIMEOUT_MS || "60000", 10);
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOW_INSECURE_TLS = process.env.ALLOW_INSECURE_TLS === "1";

if (ALLOW_INSECURE_TLS) {
  // SAP servers often use self-signed certs on internal networks.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

// Override Node's built-in fetch (undici) timeouts. The default connect
// timeout is only 10s, which causes UND_ERR_CONNECT_TIMEOUT against slow
// internal SAP hosts even when Postman succeeds.
const sapDispatcher = new Agent({
  connect: {
    timeout: CONNECT_TIMEOUT_MS,
    rejectUnauthorized: !ALLOW_INSECURE_TLS,
  },
  headersTimeout: HEADERS_TIMEOUT_MS,
  bodyTimeout: BODY_TIMEOUT_MS,
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 600_000,
});
setGlobalDispatcher(sapDispatcher);

if (!SHARED_SECRET) {
  console.warn("[WARN] MIDDLEWARE_SHARED_SECRET is not set — refusing all authenticated requests.");
}

const MIDDLEWARE_VERSION = "dms-sequential-upload-v5";
const app = express();
app.use(helmet());
const BODY_LIMIT = process.env.MIDDLEWARE_BODY_LIMIT || Infinity;
const BODY_LIMIT_LABEL = Number.isFinite(BODY_LIMIT) ? `${BODY_LIMIT}` : (process.env.MIDDLEWARE_BODY_LIMIT || "unbounded");
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ limit: BODY_LIMIT, extended: true }));

// Friendly JSON for oversized payloads instead of HTML 413 page.
// Registered as a 4-arg error handler AFTER body parsers so Express routes it here.
app.use((err, _req, res, next) => {
  if (err && (err.type === "entity.too.large" || err.status === 413 || err.statusCode === 413 || err.name === "PayloadTooLargeError")) {
    console.error(`[413] Payload exceeded configured middleware body limit (${BODY_LIMIT_LABEL}).`);
    return res.status(413).json({
      ok: false,
      error: `Payload too large at middleware parser. Current middleware body limit is ${BODY_LIMIT_LABEL}. ` +
             `If this value is unbounded, the 413 is from nginx or the upstream SAP endpoint instead.`,
      bodyLimit: BODY_LIMIT_LABEL,
      middlewareVersion: MIDDLEWARE_VERSION,
      code: "PAYLOAD_TOO_LARGE",
    });
  }
  return next(err);
});
app.use(morgan("tiny"));
app.use(
  cors({
    origin: CORS_ORIGINS.includes("*") ? true : CORS_ORIGINS,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type", "x-middleware-key"],
  })
);

// ---------- Helpers ----------

const { randomUUID } = require("crypto");

// Structured one-line JSON logger — every event carries the same reqId so the
// full edge -> middleware -> SAP chain can be grepped by request id.
function trace(reqId, stage, fields = {}) {
  try {
    console.log(JSON.stringify({
      svc: "vms-middleware",
      reqId,
      stage,
      ts: new Date().toISOString(),
      ...fields,
    }));
  } catch {
    console.log(`[middleware] reqId=${reqId} stage=${stage} (unserializable fields)`);
  }
}

const SENSITIVE_HEADER_KEYS = /^(authorization|x-middleware-key|cookie|proxy-authorization)$/i;
const SENSITIVE_BODY_KEYS = /(secret|password|token|api[-_ ]?key|authorization)/i;

function headerKeysOf(h) {
  if (!h) return [];
  return Object.keys(h);
}
function presentHeaderKeys(h) {
  if (!h) return {};
  const out = {};
  for (const k of Object.keys(h)) {
    out[k] = SENSITIVE_HEADER_KEYS.test(k) ? "***" : "present";
  }
  return out;
}
function safeBodyKeys(b) {
  if (!b || typeof b !== "object") return [];
  return Object.keys(b).map((k) => (SENSITIVE_BODY_KEYS.test(k) ? `${k}(***)` : k));
}

// Per-request middleware: assign / propagate reqId and start time.
app.use((req, res, next) => {
  const incoming = req.header("x-request-id");
  req.reqId = (incoming && String(incoming).trim()) || randomUUID();
  req.reqStartedAt = Date.now();
  res.setHeader("x-request-id", req.reqId);
  if (req.path !== "/" && req.path !== "/health") {
    trace(req.reqId, "req.received", {
      method: req.method,
      path: req.path,
      clientIp: req.ip,
      headerKeys: headerKeysOf(req.headers),
      headerPresence: presentHeaderKeys(req.headers),
      contentLength: Number(req.header("content-length") || 0),
      middlewareKeyPresent: Boolean(req.header("x-middleware-key")),
    });
  }
  res.on("finish", () => {
    if (req.path !== "/" && req.path !== "/health") {
      trace(req.reqId, "response.sent", {
        status: res.statusCode,
        elapsedTotalMs: Date.now() - req.reqStartedAt,
      });
    }
  });
  next();
});

function authGuard(req, res, next) {
  const provided = req.header("x-middleware-key") || "";
  const ok = Boolean(SHARED_SECRET) && provided === SHARED_SECRET;
  trace(req.reqId, "auth.result", { ok });
  if (!ok) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }
  next();
}

function basicAuthHeader(user, pass) {
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

function redact(obj) {
  if (!obj) return obj;
  const clone = { ...obj };
  if (clone.password) clone.password = "***";
  if (clone.Authorization) clone.Authorization = "Basic ***";
  return clone;
}

function estimateDmsPayloadBytes(body) {
  const uploads = Array.isArray(body?.FILE_UPLOAD) ? body.FILE_UPLOAD : [];
  return uploads.reduce((sum, item) => {
    return sum + String(item?.FILE || "").length + String(item?.FILE_PATH || "").length + 96;
  }, String(body?.BP_LIFNR || "").length + 128);
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function forwardToSap({ url, method, headers, body, reqId, username }) {
  const rid = reqId || "no-req-id";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const startedAt = Date.now();
  const upstreamMethod = method || "POST";
  const payloadStr = body == null ? null : (typeof body === "string" ? body : JSON.stringify(body));
  trace(rid, "upstream.prepared", {
    sapUrl: url,
    method: upstreamMethod,
    headerKeys: headerKeysOf(headers),
    headerPresence: presentHeaderKeys(headers),
    authMode: headers && (headers.Authorization || headers.authorization) ? "basic" : "none",
    username: username || null,
    payloadKeys: body && typeof body === "object" ? safeBodyKeys(body) : null,
    payloadBytes: payloadStr ? payloadStr.length : 0,
  });
  trace(rid, "upstream.fetch.start", { startedAt: new Date(startedAt).toISOString() });
  try {
    const init = {
      method: upstreamMethod,
      headers: { ...(headers || {}) },
      signal: controller.signal,
    };
    if (body != null && upstreamMethod !== "GET" && upstreamMethod !== "HEAD") {
      init.body = payloadStr;
      if (!init.headers["Content-Type"] && !init.headers["content-type"]) {
        init.headers["Content-Type"] = "application/json";
      }
    }
    const res = await fetch(url, init);
    const text = await res.text();
    const elapsedMs = Date.now() - startedAt;
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON */ }
    const sapHeaderKeys = [];
    res.headers.forEach((_v, k) => sapHeaderKeys.push(k));
    trace(rid, "upstream.fetch.end", {
      elapsedMs,
      sapStatus: res.status,
      sapStatusText: res.statusText,
      sapHeaderKeys,
      responseBytes: text.length,
      bodyPreview: text.slice(0, 500),
    });
    return { ok: res.ok, status: res.status, durationMs: elapsedMs, body: json ?? text };
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const info = describeFetchError(err);
    trace(rid, "upstream.fetch.error", {
      elapsedMs,
      errorName: err?.name || null,
      errorMessage: err?.message || String(err),
      errorCode: err?.code || null,
      causeCode: err?.cause?.code || null,
      causeMessage: err?.cause?.message || null,
      mapped: info,
      stack: err?.stack || null,
    });
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function describeFetchError(err) {
  const code = err?.cause?.code || err?.code || null;
  const name = err?.name || "Error";
  const msg = err?.message || String(err);
  const causeMsg = err?.cause?.message ? ` (cause: ${err.cause.message})` : "";
  if (code === "UND_ERR_CONNECT_TIMEOUT") {
    return {
      code,
      message: `TCP connect to SAP timed out after ${CONNECT_TIMEOUT_MS}ms. ` +
        `Check that the middleware host can actually reach the SAP host:port ` +
        `(firewall, VPN, routing). Postman may use a different network path. ` +
        `You can raise SAP_CONNECT_TIMEOUT_MS in the middleware .env if the ` +
        `network is just slow.`,
    };
  }
  if (code === "UND_ERR_HEADERS_TIMEOUT") {
    return { code, message: `SAP did not send response headers within ${HEADERS_TIMEOUT_MS}ms.` };
  }
  if (code === "UND_ERR_BODY_TIMEOUT") {
    return { code, message: `SAP stopped sending response body within ${BODY_TIMEOUT_MS}ms.` };
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return { code, message: `DNS lookup failed for SAP host: ${msg}` };
  }
  if (code === "ECONNREFUSED") {
    return { code, message: `SAP host actively refused the connection: ${msg}` };
  }
  if (name === "AbortError") {
    return { code: "TIMEOUT", message: `SAP request aborted after ${TIMEOUT_MS}ms (middleware AbortController fired).` };
  }
  return { code: code || name, message: `${msg}${causeMsg}` };
}

// ---------- Routes ----------

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "sharvi-sap-middleware",
    message: "Sharvi SAP middleware is running. Try GET /health or POST /sap/bp/create.",
    endpoints: ["GET /health", "POST /sap/bp/create", "POST /sap/dms/upload", "POST /sap/proxy"],
    sapConfigured: Boolean(SAP_BP_API_URL && SAP_BP_USERNAME && SAP_BP_PASSWORD),
    dmsConfigured: Boolean(SAP_DMS_API_URL && SAP_BP_USERNAME && SAP_BP_PASSWORD),
    secretConfigured: Boolean(SHARED_SECRET),
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "sharvi-sap-middleware",
    sapTarget: SAP_BP_API_URL ? new URL(SAP_BP_API_URL).host : null,
    middlewareVersion: MIDDLEWARE_VERSION,
    bodyLimit: BODY_LIMIT_LABEL,
    dmsEndpoint: "/sap/dms/upload",
    availableEndpoints: [
      "GET /health",
      "POST /sap/bp/create",
      "POST /sap/dms/upload",
      "POST /sap/proxy",
    ],
    timeouts: {
      requestMs: TIMEOUT_MS,
      connectMs: CONNECT_TIMEOUT_MS,
      headersMs: HEADERS_TIMEOUT_MS,
      bodyMs: BODY_TIMEOUT_MS,
    },
    allowInsecureTls: ALLOW_INSECURE_TLS,
    time: new Date().toISOString(),
  });
});

/**
 * POST /sap/bp/create
 * Body: the JSON array exactly as expected by SAP `vendor/bp/create`.
 * Returns SAP's response verbatim along with the upstream status code.
 */
app.post("/sap/bp/create", authGuard, async (req, res) => {
  if (!SAP_BP_API_URL || !SAP_BP_USERNAME || !SAP_BP_PASSWORD) {
    return res.status(500).json({
      ok: false,
      error: "Middleware missing SAP_BP_API_URL / SAP_BP_USERNAME / SAP_BP_PASSWORD env vars.",
    });
  }

  console.log("[bp/create] forwarding payload:", JSON.stringify(req.body).slice(0, 1000));

  try {
    const result = await forwardToSap({
      url: SAP_BP_API_URL,
      method: "POST",
      headers: { Authorization: basicAuthHeader(SAP_BP_USERNAME, SAP_BP_PASSWORD) },
      body: req.body,
      reqId: req.reqId,
      username: SAP_BP_USERNAME,
    });
    console.log(
      `[bp/create] SAP responded ${result.status} in ${result.durationMs}ms`
    );
    return res.status(200).json({
      ok: result.ok,
      sapStatus: result.status,
      durationMs: result.durationMs,
      sapResponse: result.body,
    });
  } catch (err) {
    console.error("[bp/create] error:", err);
    const info = describeFetchError(err);
    return res.status(502).json({
      ok: false,
      error: info.message,
      code: info.code,
      target: SAP_BP_API_URL,
    });
  }
});

/**
 * POST /sap/dms/upload
 * Forwards a DMS document upload payload to SAP. Body shape expected by SAP:
 *   { "BP_LIFNR": "0001061303",
 *     "FILE_UPLOAD": [ { "FILE": "<base64>", "FILE_PATH": "..." }, ... ] }
 * Response (array): [{ BP_LIFNR, MSGTYP, MSG, ERDAT, UZEIT, ... }]
 */
app.post("/sap/dms/upload", authGuard, async (req, res) => {
  if (!SAP_DMS_API_URL || !SAP_BP_USERNAME || !SAP_BP_PASSWORD) {
    return res.status(500).json({
      ok: false,
      error: "Middleware missing SAP_DMS_API_URL / SAP_BP_USERNAME / SAP_BP_PASSWORD env vars.",
    });
  }

  if (!req.body?.BP_LIFNR || !Array.isArray(req.body?.FILE_UPLOAD)) {
    return res.status(400).json({
      ok: false,
      error: "Invalid DMS payload. Expected { BP_LIFNR: string, FILE_UPLOAD: [{ FILE, FILE_PATH }] }.",
      middlewareVersion: MIDDLEWARE_VERSION,
    });
  }

  const invalidIndex = req.body.FILE_UPLOAD.findIndex((item) => !item?.FILE || !item?.FILE_PATH);
  if (invalidIndex >= 0) {
    return res.status(400).json({
      ok: false,
      error: `Invalid DMS payload at FILE_UPLOAD[${invalidIndex}]. FILE and FILE_PATH are required.`,
      middlewareVersion: MIDDLEWARE_VERSION,
    });
  }

  const fileCount = Array.isArray(req.body?.FILE_UPLOAD) ? req.body.FILE_UPLOAD.length : 0;
  const paths = req.body.FILE_UPLOAD.map((item) => item.FILE_PATH).join(", ");
  console.log(`[dms/upload] BP_LIFNR=${req.body?.BP_LIFNR} files=${fileCount} approx=${formatMb(estimateDmsPayloadBytes(req.body))} paths=${paths}`);

  try {
    const result = await forwardToSap({
      url: SAP_DMS_API_URL,
      method: "POST",
      headers: { Authorization: basicAuthHeader(SAP_BP_USERNAME, SAP_BP_PASSWORD) },
      body: req.body,
      reqId: req.reqId,
      username: SAP_BP_USERNAME,
    });
    console.log(`[dms/upload] SAP responded ${result.status} in ${result.durationMs}ms`);
    return res.status(200).json({
      ok: result.ok,
      sapStatus: result.status,
      durationMs: result.durationMs,
      sapResponse: result.body,
    });
  } catch (err) {
    console.error("[dms/upload] error:", err);
    const info = describeFetchError(err);
    return res.status(502).json({
      ok: false,
      error: info.message,
      code: info.code,
      target: SAP_DMS_API_URL,
    });
  }
});


/**
 * POST /sap/proxy
 * Generic forwarder for future SAP endpoints (PO, invoices, etc.).
 * Body: { url, method?, headers?, body?, useBasicAuth? }
 *  - If useBasicAuth is true (default), the middleware adds the configured SAP Basic Auth header.
 *  - `url` MUST point to an SAP host (validated against SAP_BP_API_URL host).
 */
app.post("/sap/proxy", authGuard, async (req, res) => {
  const { url, method, headers, body, useBasicAuth = true } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ ok: false, error: "Missing 'url' in request body." });
  }

  let targetHost;
  try {
    targetHost = new URL(url).host;
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid 'url'." });
  }

  if (!SAP_BP_API_URL) {
    console.error("[proxy] SAP_BP_API_URL is empty — middleware not configured");
    return res.status(503).json({
      ok: false,
      error: "Middleware not configured: SAP_BP_API_URL is empty in middleware/.env.",
      target: url,
    });
  }

  const allowedHost = new URL(SAP_BP_API_URL).host;
  if (targetHost !== allowedHost) {
    console.warn(`[proxy] rejected target host ${targetHost} (allowed: ${allowedHost})`);
    return res.status(403).json({
      ok: false,
      error: `Target host ${targetHost} is not allowed. Only ${allowedHost} is permitted.`,
    });
  }

  const startedAt = Date.now();
  console.log(
    `[proxy] in reqId=${req.reqId || "-"} ${method || "POST"} ${url} headers: ${JSON.stringify(redact(headers))}`,
  );

  try {
    const finalHeaders = { ...(headers || {}) };
    if (useBasicAuth && SAP_BP_USERNAME && SAP_BP_PASSWORD) {
      finalHeaders.Authorization = basicAuthHeader(SAP_BP_USERNAME, SAP_BP_PASSWORD);
    }
    const result = await forwardToSap({ url, method, headers: finalHeaders, body, reqId: req.reqId, username: useBasicAuth ? SAP_BP_USERNAME : null });
    console.log(
      `[proxy] out reqId=${req.reqId || "-"} sapStatus=${result.status} sapMs=${result.durationMs} totalMs=${Date.now() - startedAt} ${url}`,
    );
    return res.status(200).json({
      ok: result.ok,
      sapStatus: result.status,
      durationMs: result.durationMs,
      sapResponse: result.body,
    });
  } catch (err) {
    const info = describeFetchError(err);
    console.error(
      `[proxy] fail reqId=${req.reqId || "-"} totalMs=${Date.now() - startedAt} code=${info.code} ${url}: ${info.message}`,
    );
    return res.status(502).json({
      ok: false,
      error: info.message,
      code: info.code,
      target: url,
    });
  }
});

// Alias routes — handle common path mistakes so we never return raw HTML 404.
app.post(["/dms/upload", "/sap/dms", "/sap/upload"], authGuard, (req, res, next) => {
  console.log(`[alias] redirecting ${req.path} -> /sap/dms/upload`);
  req.url = "/sap/dms/upload";
  return app._router.handle(req, res, next);
});

// JSON 404 fallback so callers get a dynamic, machine-readable response
// instead of Express' default "Cannot POST ..." HTML page.
app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: `No route for ${req.method} ${req.originalUrl}`,
    middlewareVersion: MIDDLEWARE_VERSION,
    bodyLimit: BODY_LIMIT_LABEL,
    availableEndpoints: [
      "GET /health",
      "POST /sap/bp/create",
      "POST /sap/dms/upload",
      "POST /sap/proxy",
    ],
    hint: "If you expected /sap/dms/upload, confirm the running server.js is the latest build (see startup banner).",
  });
});

// ---------- Start ----------

app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`Sharvi SAP middleware listening on :${PORT}`);
  console.log(`Middleware build: ${MIDDLEWARE_VERSION}`);
  console.log(`Body limit: ${BODY_LIMIT_LABEL} (set MIDDLEWARE_BODY_LIMIT only if you intentionally want a parser cap)`);
  console.log(`========================================`);
  console.log(`SAP target: ${SAP_BP_API_URL || "(not configured)"}`);
  console.log(`CORS origins: ${CORS_ORIGINS.join(", ")}`);
  
  console.log(`Timeouts (ms): request=${TIMEOUT_MS}, connect=${CONNECT_TIMEOUT_MS}, headers=${HEADERS_TIMEOUT_MS}, body=${BODY_TIMEOUT_MS}`);
  if (ALLOW_INSECURE_TLS) console.log("TLS verification: DISABLED (ALLOW_INSECURE_TLS=1)");
});
