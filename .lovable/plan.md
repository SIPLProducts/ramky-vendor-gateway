## 1. Vendor Location auto-fills from State (input field)

`src/components/vendor/steps/OrganizationStep.tsx`

- Replace the disabled/grey display with a normal-looking `<Input readOnly>` that mirrors the selected State value (e.g. `Telangana`) — not the SAP mapped code.
- Update the auto-populate `useEffect` (lines 157–170) to set `vendorLocation` to `[watchedState]` directly when state changes, and clear it when state is cleared. Remove the `mapStateToSapLocationCode` / `getLocationLabel` usage for the visible field.
- Helper text: "Auto-filled from State". No "Select State first" greyed-out state — show the State as-is.
- `SapFieldsDialog.tsx` already shows Vendor Location as read-only; it will continue to render whatever value is stored (now the State name), no further change needed.

## 2. Address Line 1 overflow into Lines 2–4 (Registered / Corporate Office only)

`src/components/vendor/steps/AddressStep.tsx`

- Replace the plain `register('registeredAddress')` on Address Line 1 with a controlled `onChange` that:
  - Accepts the full pasted/typed string (no `maxLength={40}` cap on Line 1 typing — we still slice to 40).
  - Splits the input into chunks of 40 characters, preferring to break on the last space within the 40-char window so words aren't cut mid-word; falls back to a hard 40-char cut if no space.
  - Writes chunk 1 to `registeredAddress`, chunk 2 to `registeredAddressLine2`, chunk 3 to `registeredAddressLine3`, chunk 4 to `registeredAddressLine4`. Any text beyond 160 chars is dropped (Line 4 capped at 40).
  - Uses `setValue(..., { shouldValidate: true, shouldDirty: true })` so the existing 40-char zod rules and downstream `sameAsRegistered` mirror logic keep working.
- Lines 2–4 inputs remain editable; if the user types in them directly we leave their value alone (only Line 1 typing triggers the auto-flow). Manufacturing/Branch address blocks are not changed.

## 3. MSME — show Upload Udyam Certificate beside Udyam Number, mandatory

`src/components/vendor/kyc/MsmeKycTab.tsx`

- Remove the Manual / Upload `Tabs` split. When "Are you MSME / Udyam Registered?" = Yes, render a single two-column grid:
  - Left: existing `ManualEntryAndVerify` for Udyam Number (unchanged behaviour: Verify via API).
  - Right: new "Upload Udyam Certificate *" file input using the same `FileUpload` component used by GST/PAN/Bank tabs, wired to `props.msmeCertificateFile` / `props.onMsmeCertificateFileChange`. Accept PDF/JPG/PNG, same size limit as the other KYC docs.
- Keep the existing OCR cross-check (Enterprise Name match) — trigger it automatically after a file is uploaded, reusing the current `runMsmeOcr` + `handleOcrVerify` flow that the Upload tab uses today.
- Mandatory enforcement:
  - Show red "*" on the upload label.
  - In `ComplianceStep.tsx`, block "Next" when `isMsmeRegistered === true` AND `msmeCertificateFile` is null/empty (mirror the same gating used for GST certificate). Surface an inline error: "Udyam Certificate is required."
- Storage: no change needed — `useVendorRegistration.tsx` already uploads `msmeCertificateFile` with `type: 'msme_certificate'` to the same `vendor-documents` bucket / `vendor_documents` table used by GST, PAN, and Bank docs.

## 4. Verification

- Type a 120-char string into Address Line 1 → expect Lines 1–3 to fill at word boundaries, each ≤40 chars.
- Pick a State in Organization step → Vendor Location input shows that state, read-only; SAP Sync popup shows the same value.
- Select MSME = Yes → both fields visible; trying to proceed without a file blocks with the new error; uploading runs OCR; on submit the file lands in `vendor_documents` with `document_type = 'msme_certificate'`.

## Files touched

- `src/components/vendor/steps/OrganizationStep.tsx` — Vendor Location input + simplified effect
- `src/components/vendor/steps/AddressStep.tsx` — Address Line 1 overflow handler
- `src/components/vendor/kyc/MsmeKycTab.tsx` — single-view layout with mandatory upload
- `src/components/vendor/steps/ComplianceStep.tsx` — gate "Next" on MSME cert when MSME = Yes

No DB, edge function, or storage bucket changes.
