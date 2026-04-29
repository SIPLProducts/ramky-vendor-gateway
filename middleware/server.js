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

const PORT = parseInt(process.env.PORT || "3002", 10);
const SHARED_SECRET = process.env.MIDDLEWARE_SHARED_SECRET || "";
const SAP_BP_API_URL = process.env.SAP_BP_API_URL || "";
const SAP_BP_USERNAME = process.env.SAP_BP_USERNAME || "";
const SAP_BP_PASSWORD = process.env.SAP_BP_PASSWORD || "";
const TIMEOUT_MS = parseInt(process.env.SAP_REQUEST_TIMEOUT_MS || "30000", 10);
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOW_INSECURE_TLS = process.env.ALLOW_INSECURE_TLS === "1";

if (ALLOW_INSECURE_TLS) {
  // SAP servers often use self-signed certs on internal networks.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

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
  try {
    const res = await fetch(url, {
      method: method || "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: body == null ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // SAP returned non-JSON — pass through as text.
    }
    return {
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - startedAt,
      body: json ?? text,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Routes ----------

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
    return res.status(502).json({
      ok: false,
      error: err.name === "AbortError" ? "SAP request timed out" : err.message || "Upstream error",
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
    return res.status(502).json({
      ok: false,
      error: err.name === "AbortError" ? "SAP request timed out" : err.message || "Upstream error",
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
