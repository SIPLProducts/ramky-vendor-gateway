## Why approvers see "-" for PAN Holder Name / PAN Status

The approver's "All Details" dialog reads `vendors.pan_holder_name`, `vendors.pan_status`, `vendors.pan_aadhaar_linked` directly from the row. For most recently-verified vendors these columns are `NULL`, so the dialog shows "-".

Root cause (verified against the DB and code):

1. In `src/components/vendor/steps/ComplianceStep.tsx`, `panHolderName` returned by the PAN OCR is stored only in a **local `useState`** (line 134) and passed to sibling tabs for cross-checks. It is **never written back to `formData.statutory.panHolderName`**, so on final save `useVendorRegistration` writes `null` into `vendors.pan_holder_name` (line 490).
2. `panStatus` and `panAadhaarLinked` *are* saved via `onComprehensiveResult` → `setValue(...)`, but only when the PAN Comprehensive provider returns them. For older rows verified before that wiring, they remain `NULL`.
3. The dialog has no fallback: when the column is `NULL`, it prints "-" even though the same information exists elsewhere on the vendor row (legal/trade name for holder, verified PAN with a passed validation for status).

DB check confirms the pattern: only 1 of 2 verified vendors has `pan_holder_name`; none have `pan_aadhaar_linked`.

## Fix

### 1. Persist PAN Holder Name during registration
`src/components/vendor/steps/ComplianceStep.tsx` — in `handlePanVerified`, also push the extracted holder name into the form state so it saves to `vendors.pan_holder_name`:

```ts
if (name) {
  setPanHolderName(name);
  setValue('panHolderName' as any, name);   // <— new
}
```

No schema change needed — `useVendorRegistration` already maps `formData.statutory.panHolderName` → `pan_holder_name` and loads it back on edit.

### 2. Safe display fallbacks in the approver dialog
`src/components/vendor/VendorReviewDialog.tsx` (Statutory Details block around lines 590–596). Only affects presentation when the DB column is `NULL`:

- **PAN Holder Name**: fall back to `msme_enterprise_name` → `account_holder_name` → `trade_name` → `legal_name`, then "-".
- **PAN Status**: if `pan_status` is null but the vendor has a PAN and `pan_verification_status = 'passed'`, show "Valid"; else keep existing `formatPanStatus` output.
- **Is Aadhaar Linked**: leave `formatAadhaarLinked` behavior but change the label for `null` to a neutral "-" instead of the current misleading "Aadhaar Not Linked with PAN" (a `NULL` value is unknown, not "not linked").

`src/lib/panComprehensive.ts` — update `formatAadhaarLinked` to return `-` for `null`/`undefined`, `Aadhaar Linked with PAN` for `true`, `Aadhaar Not Linked with PAN` for `false`.

### 3. Backfill existing rows (one-off migration)
Migration to fill obvious gaps so approvers see values on already-submitted vendors:

```sql
UPDATE public.vendors
   SET pan_holder_name = COALESCE(
         pan_holder_name,
         NULLIF(trim(msme_enterprise_name), ''),
         NULLIF(trim(account_holder_name), ''),
         NULLIF(trim(trade_name), ''),
         NULLIF(trim(legal_name), '')
       )
 WHERE pan IS NOT NULL AND pan <> '' AND (pan_holder_name IS NULL OR pan_holder_name = '');

UPDATE public.vendors
   SET pan_status = 'valid'
 WHERE pan IS NOT NULL AND pan <> ''
   AND pan_status IS NULL
   AND pan_verification_status = 'passed';
```
(No change to `pan_aadhaar_linked` — leave `NULL` where genuinely unknown; UI will now render "-" for it.)

## Scope

- No changes to KYC verification logic, edge functions, SAP payloads, or approval flow.
- Only touches: `ComplianceStep.tsx` (1 line added), `VendorReviewDialog.tsx` (3 field renders), `panComprehensive.ts` (1 helper), 1 migration.
- After the fix, all newly verified vendors persist PAN Holder Name; existing vendors get a sensible display via backfill + fallback.
