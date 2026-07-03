## Problem

On the Edit vendor registration flow, Document Verification tabs (GST / PAN / MSME / Bank) hydrate the extracted values into the UI but do NOT show the same "verified" affordances that appear right after successful validation:

- Green input borders on each field
- "X is verified" / "matches registry" success text under each field
- "verified · Xh ago" timestamp on the stage header

Reason: `EditableOcrField` marks a field verified only when the current value equals the corresponding `apiData` (or `apiData.normalized`) value. When we seed `DocState` from `initialData` in `DocumentVerificationStep.tsx`, we set only a partial `apiData` (`{ legalName }`, `{ name }`, etc.) and no `verifiedAt`. PAN already seeds `apiData.normalized` correctly — that's why the PAN screenshot looks right — but GST, MSME, Bank, and Bank2 do not.

## Fix

Edit `src/components/vendor/steps/DocumentVerificationStep.tsx` — only the four `useState<DocState>` initializers for `gstDoc`, `msmeDoc`, `bankDoc`, `bankDoc2`. For each, when `initialData.<section>` exists:

1. Build `apiData` to match the shape each verified-field block reads from:
   - GST → flat keys on `apiData` (`legal_name`, `trade_name`, `gstin`, `constitution_of_business`, `principal_place_of_business`, `gst_status`, `registration_date`, `taxpayer_type`, `jurisdiction_centre`, `jurisdiction_state`, plus a `pan_number` if derivable).
   - MSME → `apiData.normalized = { udyam_number, enterprise_name, enterprise_type, major_activity }`.
   - Bank / Bank2 → `apiData.normalized = { account_number, ifsc_code, bank_name, branch_name, account_holder_name }`.
2. Populate `verifiedAt: Date.now()` so `StageShell` shows the "verified · Xh ago" pill and stage tick.

No other behavior changes: fields stay editable, "Replace" still resets the doc state, and re-verification still overwrites `apiData` with fresh registry values. PAN seeding is already correct — leave it untouched.

## Verification

1. Open a previously-saved (returned-to-vendor) application → Document Verification → each tab (GST, PAN, MSME, Bank).
2. Confirm every populated field has the green border, the "…is verified" caption, and the stage header shows "verified · …".
3. Edit a field → "Edited" badge appears (mismatch state), matches initial-registration behavior.
4. Click Replace → fields reset as before.

## Out of scope

- No changes to save/hydration logic in `useVendorRegistration` or `VendorRegistration.tsx`.
- No changes to validation APIs or verification pipelines.
- Feedback popup, invitation flow, and other screens untouched.
