# SAP Sync Screen — 3 Fixes

## Point 1 — Required field validation on "Sync to SAP"

In `SapFieldsDialog`, before invoking the edge function, validate that these 6 fields have a value. If any is empty, show an inline error banner + red ring on the missing fields and block the call.

Required:
- Vendor Account Group (`partn_grp`)
- Company Code (`bukrs`)
- Rec-Account (`akont`)
- Planning Group (`fdgrv`)
- Purchase Org (`vkorg`)
- Currency (`waers`)

Add a small "Required" label/asterisk to those 6 fields. The "Sync to SAP" button stays enabled but click triggers validation first; on failure show toast "Please fill all required SAP fields" and highlight the missing ones.

## Point 2 — Classification fields auto-filled from vendor data (disabled)

In the Classification section, change the 4 inputs from editable `TextField` to **read-only/disabled** fields pre-populated from the vendor record:

| SAP field | Source on vendor |
|---|---|
| Material Category (`MGV`) | `vendor.product_categories` (first entry, joined if multi) |
| Vendor Category (`CATV`) | `vendor.industry_type` (or `organization_type` if industry_type empty) |
| Vendor Location (`LOCV`) | `vendor.registered_state` |
| Vendor Identification (`IDS`) | `vendor.gstin` (fallback `vendor.pan`) |

Render with the same `ReadOnlyField` style used elsewhere in the dialog and still send them in the payload via `overrides.classify`. No manual override.

> Confirmation needed: are these the correct source fields, or should I map differently (e.g. IDS = PAN, MGV = industry_type)? Default mapping above will be used unless you specify otherwise.

## Point 3 — Send empty UPLOAD array to avoid HTTP 413

Current `sync-vendor-to-sap` edge function reads every vendor document (PDF/image), base64-encodes them, and pushes them into the `UPLOAD` array of the SAP payload. With multiple documents this exceeds the middleware body limit → `PayloadTooLargeError: request entity too large` (the screenshot 413 error).

Fix in `supabase/functions/sync-vendor-to-sap/index.ts`:
- Skip the `buildUploadArray` call.
- Always set `uploads = []` so the template emits an empty `UPLOAD: []`.
- Leave the document-upload machinery intact in code (commented call) so it can be re-enabled later when middleware/SAP supports larger uploads or a streaming upload path.

Add an info note in the SAP Sync result dialog: *"Document attachments are temporarily disabled to stay within SAP middleware payload limits. They will be enabled in a future release."*

## Files to change

- `src/components/sap/SapFieldsDialog.tsx` — required-field validation, classification fields → disabled & auto-populated.
- `supabase/functions/sync-vendor-to-sap/index.ts` — force `uploads = []`.
- `src/pages/SAPSync.tsx` — small info text in success/failure dialog.

## Out of scope

- Re-enabling document upload (separate task — needs streaming/chunking or middleware limit raise).
- Adding new vendor form fields for classification (we reuse existing vendor data).
- Changes to the F4 master-data fetch flow.
