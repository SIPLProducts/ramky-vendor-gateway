
## Problem

When a vendor uploads a PAN card, both API calls actually succeed:

- **PAN OCR** (`/api/v1/ocr/pan`) → `success: true`, extracts `AABCF1735D` / `Foss India Private Limited`
- **PAN Comprehensive** (`/api/v1/pan/pan-comprehensive`) → `success: true`, `data.status: "valid"`

But the UI still shows a red **Failed** pill on the file row and a destructive alert containing the word **"success"** (the upstream `message_code`). This blocks the vendor from continuing to MSME.

## Root cause

In `src/components/vendor/steps/DocumentVerificationStep.tsx`, the PAN branch of `verifyApi` (around line 846–856) does:

```ts
const comprehensive = extractPanComprehensiveFields(r);
const apiStatus = String(comprehensive.status ?? "").toLowerCase().trim();
if (!r.ok || apiStatus !== "valid") {
  return { ok: false, message: r.message || "PAN validation failed..." };
}
```

`extractPanComprehensiveFields(r)` uses `collectPanResponseObjects` which walks the `KycApiResult` wrapper starting from `r` itself, then `r.data`, `r.raw`, etc. It then reads `data.status ?? data.pan_status ?? ...` with `??=` (assign-if-nullish).

The problem: the outer `KycApiResult` envelope produced by `kyc-api-execute` also has a top-level `status` field (the HTTP status, `200`). So on the very first iteration `statusRaw` is assigned `200` (a number, not nullish), and the real `data.status = "valid"` never overrides it. `apiStatus` becomes `"200"`, the guard triggers, and the error message shown to the user is `r.message`, i.e. Surepass's `message_code` `"success"`.

This is the same envelope-collision hazard as the earlier PAN Comprehensive parser. Nothing changed in the API — the wrapper's `status: 200` field just happens to shadow the inner payload's `status: "valid"`.

## Fix

Change `extractPanComprehensiveFields` (and the twin helper `parsePanStatus` in `src/components/vendor/kyc/PanKycTab.tsx`) so it only reads `status` from **inner payload objects**, never from the `KycApiResult` envelope.

Concretely, in `src/components/vendor/steps/DocumentVerificationStep.tsx`:

1. Update `collectPanResponseObjects(source)` (or add a sibling `collectPanPayloadObjects`) so it does not include the outer `KycApiResult` itself in the returned list — start traversal from `source.data`, `source.raw`, `source.result`, `source.response`, `source.response_data`. This drops the envelope's `status` / `status_code` / `success` / `message_code` fields from the search space entirely.
2. Keep the rest of `extractPanComprehensiveFields` unchanged (still prefers `data.status`, falls back to `pan_status`, etc., still resolves `aadhaar_linked`).
3. Apply the identical change to `parsePanStatus` in `src/components/vendor/kyc/PanKycTab.tsx` so the standalone PAN KYC tab is not vulnerable to the same collision.

Also add a small defensive filter inside `extractPanComprehensiveFields`: ignore any `status` value that is a number or a purely numeric string (e.g. `200`, `"200"`) — the real PAN Comprehensive `status` is always textual (`"valid"`, `"invalid"`, `"deactivated"`, etc.). This makes the parser resilient even if a future wrapper adds another numeric `status`-shaped field.

## Verification

- PAN upload with the response you shared → the file row shows **Verified**, PAN Holder Name populates, "Continue to MSME" becomes enabled.
- `pan_status` still persists to `vendors.pan_status` as `"valid"`.
- No changes to the edge function, DB schema, or other tabs (GST/MSME/Bank).

## Files touched

- `src/components/vendor/steps/DocumentVerificationStep.tsx` — narrow `collectPanResponseObjects` / harden `extractPanComprehensiveFields`.
- `src/components/vendor/kyc/PanKycTab.tsx` — mirror the same narrowing in `parsePanStatus` / `parseAadhaarLinked`.
