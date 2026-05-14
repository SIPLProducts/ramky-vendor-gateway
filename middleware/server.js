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

const app = express();
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("tiny"));
app.use(
  cors({
    origin: CORS_ORIGINS.includes("*") ? true : CORS_ORIGINS,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type", "x-middleware-key"],
  })
);

// ---------- Helpers ----------

function authGuard(req, res, next) {
  const provided = req.header("x-middleware-key") || "";
  if (!SHARED_SECRET || provided !== SHARED_SECRET) {
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

async function forwardToSap({ url, method, headers, body }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const startedAt = Date.now();
  const upstreamMethod = method || "POST";
  console.log(`[forwardToSap] -> ${upstreamMethod} ${url}`);
  try {
    const init = {
      method: upstreamMethod,
      headers: { ...(headers || {}) },
      signal: controller.signal,
    };
    // Only attach a body / content-type for methods that have one.
    if (body != null && upstreamMethod !== "GET" && upstreamMethod !== "HEAD") {
      init.body = typeof body === "string" ? body : JSON.stringify(body);
      if (!init.headers["Content-Type"] && !init.headers["content-type"]) {
        init.headers["Content-Type"] = "application/json";
      }
    }
    const res = await fetch(url, init);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* non-JSON */ }
    console.log(`[forwardToSap] <- ${res.status} in ${Date.now() - startedAt}ms (${url})`);
    return { ok: res.ok, status: res.status, durationMs: Date.now() - startedAt, body: json ?? text };
  } catch (err) {
    console.error(`[forwardToSap] FAILED after ${Date.now() - startedAt}ms ${upstreamMethod} ${url}:`, err);
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
    endpoints: ["GET /health", "POST /sap/bp/create", "POST /sap/proxy"],
    sapConfigured: Boolean(SAP_BP_API_URL && SAP_BP_USERNAME && SAP_BP_PASSWORD),
    secretConfigured: Boolean(SHARED_SECRET),
  });
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "sharvi-sap-middleware",
    sapTarget: SAP_BP_API_URL ? new URL(SAP_BP_API_URL).host : null,
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

  if (SAP_BP_API_URL) {
    const allowedHost = new URL(SAP_BP_API_URL).host;
    if (targetHost !== allowedHost) {
      return res.status(403).json({
        ok: false,
        error: `Target host ${targetHost} is not allowed. Only ${allowedHost} is permitted.`,
      });
    }
  }

  console.log("[proxy] forwarding", method || "POST", url, "headers:", redact(headers));

  try {
    const finalHeaders = { ...(headers || {}) };
    if (useBasicAuth && SAP_BP_USERNAME && SAP_BP_PASSWORD) {
      finalHeaders.Authorization = basicAuthHeader(SAP_BP_USERNAME, SAP_BP_PASSWORD);
    }
    const result = await forwardToSap({ url, method, headers: finalHeaders, body });
    return res.status(200).json({
      ok: result.ok,
      sapStatus: result.status,
      durationMs: result.durationMs,
      sapResponse: result.body,
    });
  } catch (err) {
    console.error("[proxy] error:", err);
    const info = describeFetchError(err);
    return res.status(502).json({
      ok: false,
      error: info.message,
      code: info.code,
      target: url,
    });
  }
});

// ---------- Start ----------

app.listen(PORT, () => {
  console.log(`Sharvi SAP middleware listening on :${PORT}`);
  console.log(`SAP target: ${SAP_BP_API_URL || "(not configured)"}`);
  console.log(`CORS origins: ${CORS_ORIGINS.join(", ")}`);
  if (ALLOW_INSECURE_TLS) console.log("TLS verification: DISABLED (ALLOW_INSECURE_TLS=1)");
});
