## Goal

1. In the SAP Field Confirmation popup (SapFieldsDialog), make all MSME Details fields **read-only display** (MSME Registered, Udyam/MSME Number, MSME Category, Major Activity / IDCATG).
2. Confirm SAP sync continues to send `UPLOAD: []` (no files), and DMS sync continues to upload all files. No backend behavior changes.

## Changes

### `src/components/sap/SapFieldsDialog.tsx`

In the "MSME Details" section (lines ~186–217), replace the editable controls with `ReadOnlyField` displays sourced from the vendor record:

- "MSME Registered" → `ReadOnlyField` showing "Yes" / "No" (from `vendor.is_msme_registered` or `msme_number` presence).
- "Udyam / MSME Number" → `ReadOnlyField` from `vendor.msme_number`.
- "MSME Category" → `ReadOnlyField` from `vendor.msme_category` (display label: Micro/Small/Medium).
- "Major Activity (IDCATG)" → `ReadOnlyField` from `vendor.msme_major_activity`.
- Update the helper note text to: "MSME details are taken from the vendor registration record and pushed to SAP as-is."

Keep `SapFieldOverrides` shape unchanged. The `reg_is_msme`, `reg_msme_no`, `reg_msme_cat`, `reg_msme_act` values continue to be initialized in `buildDefaults` from the vendor record and forwarded via `onConfirm` exactly as today — the only difference is the user cannot edit them in the popup. The Sync-to-SAP submit handler that derives `msme` (MIC/SMA/MED/ZNA), `idtype`, `idnum` from these values stays identical.

### SAP sync upload behavior — no change needed

Already in place from prior work:
- `src/lib/sapPayloadBuilder.ts` sets `row.UPLOAD = []` unconditionally; `buildUploads` is no longer called.
- `supabase/functions/sync-vendor-to-sap/index.ts` forces `row.UPLOAD = []` on both client-supplied and legacy server-built code paths.

### DMS sync — no change

`supabase/functions/sync-vendor-to-dms/index.ts` continues to upload all vendor documents to the DMS endpoint as today. Trigger logic in `useVendors.tsx` (DMS call fired after a successful BP create) is untouched.

## Out of scope

- No schema changes, no edge-function redeploy needed (no server logic changes).
- No changes to MultipleSapSyncDialog, payload template, or SAP master data flows.
- No change to how MSME overrides flow through the payload — only the popup UI becomes read-only.
