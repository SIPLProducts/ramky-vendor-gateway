## 1. MSME tab — remove Upload tab, add file upload inside Manual Entry

**File:** `src/components/vendor/steps/DocumentVerificationStep.tsx`

- Delete the `Tabs / TabsList / TabsTrigger` wrapper (Manual Entry | Upload) in the MSME section (around lines 2237–2434) and the `<TabsContent value="upload">` block (≈ lines 2436 to its closing tag).
- Keep the Manual Entry contents as the only layout (Udyam Number input + Validate button + verified fields grid).
- Add a new field below the Udyam Number / Validate row labeled **"Upload Udyam Certificate (optional)"** using the existing `FileUpload` component.
  - Wire it to `msmeDoc.file` / `setMsmeDoc` so the file persists into form state (`msmeCertificateFile`) the same way GST/PAN/Bank do.
  - File upload is independent of validation — vendor can attach the certificate before or after clicking Validate. No OCR is triggered from this upload (manual flow is the source of truth).
- Remove the now-unused `msmeMode` / `setMsmeMode` state and the `Upload` icon import if no longer referenced.

## 2. Organization Profile — auto-populate State from GST

**File:** `src/components/vendor/steps/OrganizationStep.tsx`

- Add a new optional prop `gstData?: GstDetails` (already on `formData.gst`).
- Pass it from `src/pages/VendorRegistration.tsx` (line 1188): `gstData={formData.gst}`.
- Add a `useEffect` that runs when `gstData` becomes available:
  - Derive candidate state from `gstData.addressParts?.state` first, then `gstData.jurisdictionState`.
  - Normalize (case-insensitive match) against the `INDIAN_STATES` list to find the exact option.
  - If the form's current `state` is empty and a match is found, call `setValue('state', match, { shouldValidate: true, shouldDirty: true })`.
- Do not override a state the vendor has already chosen.

## Verification

- Open MSME tab → confirm only Manual Entry layout shows, Udyam Number + Validate + file upload field present, no tabs.
- Upload a file → advance to Review/Approval → confirm MSME certificate is visible in compliance docs list.
- Complete GST OCR with a state (e.g. Telangana) → open Step 2 → confirm the State dropdown is pre-selected with that state. Change it manually → reload → confirm manual selection is preserved.
