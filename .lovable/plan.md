# Vendor Registration — Back Button + Full Reset on Type Switch

## 1. Replace "Change" with "Back" button

File: `src/pages/VendorRegistration.tsx` (lines ~1091–1109)

- Replace the ghost "Change" button next to the "Vendor Type: …" chip with a **Back** button that matches the reference screenshot:
  - Label: `Back`
  - Left `ArrowLeft` icon (lucide-react)
  - Outline/ghost style, rounded, small size, right-aligned (same position)
- Click behaviour unchanged in intent: returns user to the Vendor Type selector (`setVendorTypeChosen(false)` + `setPendingChoiceType(formData.vendorType)`), but now also triggers the full reset flow below so data does not leak across types.

## 2. Auto-refresh all data when switching vendor type

Today `applyVendorTypeSwitch` only clears the in-memory slice of the *other* type. The user reports that after going back and switching Domestic ↔ International, previously entered fields and **uploaded documents** still appear. Fix:

File: `src/pages/VendorRegistration.tsx`

- In `applyVendorTypeSwitch(next)`:
  1. Reset **both** slices to empty, not just the abandoned one:
     - Spread `EMPTY_DOMESTIC_SLICES` and set `international: EMPTY_INTERNATIONAL_DATA` regardless of `next`.
  2. Reset auxiliary state already handled (`completedSteps`, `currentStep`, `verifiedData`, `latestStep1DataRef`), plus:
     - `setCustomFieldValues({})` if present
     - `setPendingChoiceType(next)` so the selector reflects the new choice
  3. If a `vendorId` exists (draft was saved), call a new helper `purgeVendorArtifacts(vendorId)` that:
     - Deletes all rows from `vendor_documents` for that vendor
     - Deletes the corresponding files from the `vendor-documents` storage bucket (list by `${vendorId}/` prefix, then `storage.remove`)
     - Deletes vendor verification rows (`vendor_validations` / `verified_documents` if used by Step 1)
     - Updates the `vendors` row: set `vendor_type = next`, null out all type-specific columns (legal_name, pan, gstin, bank_*, international fields, etc.) using a single update with the empty payload derived from `EMPTY_DOMESTIC_SLICES` / `EMPTY_INTERNATIONAL_DATA`.
     - Errors are toasted but do not block the UI reset.
  4. Show a toast: "Switched to {Domestic|International}. Previous data cleared."

- Drop the confirmation `AlertDialog` for the type switch (lines 971 and 1264) **only when triggered by the Back button**, because the user explicitly wants automatic refresh. Keep behaviour: clicking Back always returns to selector; selecting a different type always purges. Selecting the same type is a no-op.

## 3. Reset uploaded-file UI state

- After purge, ensure `IntlDocumentsStep` and Step 1 (`DocumentVerificationStep`) reset their internal previews because `data.registrationCopyFile` / `data.swiftIbanFile` / `verifiedData` are now empty. Already handled via props — confirm by passing fresh empty objects.

## Out of scope

- No schema changes.
- No edge function changes.
- KYC/SAP/approval logic untouched.
- Other steps unchanged.

## Files touched

- `src/pages/VendorRegistration.tsx` — button swap + reset/purge logic + helper
- (Optional) small helper in same file; no new files required
