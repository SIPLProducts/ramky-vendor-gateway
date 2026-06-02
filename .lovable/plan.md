## Goal

When a vendor uploads a document in Step 1 (GST certificate, PAN card, Udyam/MSME, cancelled cheque) the values OCR'd from it should appear automatically in the matching fields across **all** later steps (Organization, Address, Statutory, Bank, Compliance). Anything the vendor has already typed is preserved.

## What's working today

`mergeVerifiedDataIntoForm` in `src/pages/VendorRegistration.tsx` already pushes most GSTIN, PAN number, MSME number/category, address and primary-bank values into the form using a `data.x || prev.x` pattern.

## Gaps to fix

1. **PAN holder name** is captured but never written to `organization.legalName` when GST = No and the manual legal name is blank.
2. **MSME enterprise name** and **major activity** are captured but only the Compliance step picks them up locally — they are not pushed into `formData.statutory` so a draft save loses them.
3. **Bank account holder name** for the primary bank is captured but `BankDetails` has no field for it → not surfaced anywhere downstream (Compliance step has its own copy but the saved form doesn't).
4. **Secondary bank** values use `||` correctly but `secondary.enabled` flips to `true` from OCR even if the user had not opted in — should respect prior `enabled` flag.
5. **Empty-string vs typed** — current `||` treats `"0"` as empty and would overwrite. Switch the merge to an explicit "fill only when prev is empty/undefined" helper so vendor-typed values are always preserved.
6. **Live merge runs on every keystroke of OCR state** — fine, but autosave can churn. Keep the existing JSON-key short-circuit, just extend it to cover the new fields.

## Changes

### `src/types/vendor.ts`

- Add `accountHolderName?: string` to `BankDetails` (primary). Optional, defaults to `""` in initial state.
- Add `msmeEnterpriseName?: string` and `msmeMajorActivity?: string` to `StatutoryDetails`.

### `src/pages/VendorRegistration.tsx`

- Introduce a small helper at the top of the file:

  ```ts
  const fill = <T,>(prev: T, next: T | undefined | null): T =>
    (prev !== undefined && prev !== null && prev !== '') ? prev : ((next ?? prev) as T);
  ```

- Rewrite `mergeVerifiedDataIntoForm` to use `fill(prev.x, data.x)` everywhere instead of `data.x || prev.x`. Semantics: **user-typed value always wins**; OCR only fills blanks.
- Add new mappings:
  - `organization.legalName ← fill(prev, gst.legalName ?? pan.holderName ?? manualLegalName)`
  - `statutory.msmeEnterpriseName ← fill(prev, data.msme?.enterpriseName)`
  - `statutory.msmeMajorActivity   ← fill(prev, data.msme?.majorActivity)`
  - `bank.accountHolderName        ← fill(prev, data.bank?.accountHolderName)`
- For `bank.secondary`: only build the secondary object when **either** `prev.bank.secondary?.enabled` is already true **or** the vendor explicitly enabled bank 2 in Step 1 (already represented by `data.bank2` only being present when `bank2Enabled`). Inside, every field uses `fill`.
- Add the new fields to the JSON-key short-circuit so autosave doesn't tick unnecessarily.

### `src/hooks/useVendorRegistration.tsx` (initial state)

- Default `formData.bank.accountHolderName = ''`.
- Default `formData.statutory.msmeEnterpriseName = ''`, `formData.statutory.msmeMajorActivity = ''`.
- Persist/load these in the existing draft round-trip (add to the column or JSON blob that already carries statutory/bank — match whatever the hook does for the sibling fields; no schema change is required because both tables already use a JSON column for the same shape — confirm during implementation and only migrate if a dedicated column is used).

### `src/components/vendor/steps/ComplianceStep.tsx`

- Replace the local `msmeEnterpriseName`, `msmeMajorActivity`, `accountHolderName` state with values read from `formData.statutory.*` / `formData.bank.accountHolderName` so the Compliance step reflects the auto-filled values immediately and stays in sync with Step 1 re-uploads.
- Keep its own OCR-trigger code as a fallback for users who navigate straight to Compliance without finishing Step 1.

### `src/components/vendor/steps/FinancialStep.tsx` (or wherever bank section renders)

- If a bank "Account holder name" input doesn't already exist, add it next to "Account number" and bind to `formData.bank.accountHolderName`. Read-only when populated from OCR is *not* required — keep it editable so the vendor can correct.

## Non-changes

- No edge function, RLS, migration, or nginx changes.
- Verification gating, approval flow, DMS payload, and SAP sync stay untouched — they read from `vendor_documents` / `formData` which now simply has more populated fields.
- OCR pipeline (`ocr-extract`, `kyc-api-execute`, `mergeOcrExtracted`) is unchanged.

## Validation

1. Fresh registration: upload GST → Organization shows legal/trade name, Address shows principal place, Statutory shows GSTIN + constitution + jurisdiction without typing.
2. Type a different legal name manually, then re-upload GST → typed value is preserved, other blank fields still fill.
3. Upload PAN with GST = No and manual legal name empty → Organization legalName auto-fills from PAN holder name.
4. Upload Udyam → Statutory MSME number, category, **enterprise name, major activity** populate; navigate to Compliance and confirm same values are shown.
5. Upload cheque → Bank section shows account number, IFSC, bank name, branch **and account holder name**.
6. Save Draft, reload → all auto-filled values persist.
7. Regression: secondary bank stays disabled unless explicitly enabled; autosave does not loop.
