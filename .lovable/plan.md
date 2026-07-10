## Goal
When SAP responds with a duplicate error (`MSGTYP: E` + PAN / PAN+GST duplicate message), the "Vendor Closed — Duplicate detected in SAP" email must include an **Existing Vendor Details** section parsed from the SAP `MSG_TEXT` field (format: `SAPCODE - NAME - PAN - GSTIN`). Non-duplicate flows are unchanged.

## Changes

### 1. `src/pages/SAPSync.tsx` — extract existing-vendor info and forward it
- Extend `isPanDuplicateResponse(resp)` to also return `msgText` — scan `ACC_RES` rows for `MSG_TEXT` (fallback: any row field matching the `code - name - PAN - GSTIN` shape).
- Update `autoRejectAsDuplicate(vendorId, remarks, msgText?)` to pass `existingVendorText: msgText` in the invoke body.
- Update both call sites (single `handleConfirmSync`, bulk `handleMultipleSync`) to forward `dup.msgText`.

### 2. `supabase/functions/sap-team-reject-vendor/index.ts` — render the section
- Accept optional `existingVendorText` in the request body.
- Add a small parser: split by ` - ` (or `-` with surrounding spaces), trim to 4 parts → `{ sapCode, vendorName, pan, gstin }`. Skip empty parts gracefully.
- When `autoTriggered === true` **and** parsed values exist, insert an **Existing Vendor Details** block immediately after the Reason row (or after the main table), containing:
  - SAP Vendor Code
  - Vendor Name
  - PAN Number
  - GSTIN
- Use the existing `row(k,v)` / `esc(...)` helpers and matching table style. If parsing fails, fall back to showing the raw `existingVendorText` as a single row so nothing is lost.
- Manual rejections (no `existingVendorText`) render exactly the current email.

## Out of scope
No changes to DB, RLS, workflow, edge-function auth, or the sync-to-SAP function itself. Purely additive email content driven by a new optional payload field.

## Verification
- `bunx tsgo --noEmit`
- Trigger a duplicate SAP sync in preview → confirm the closure email shows the new "Existing Vendor Details" section with parsed values; trigger a manual (non-duplicate) close → confirm the email is unchanged.