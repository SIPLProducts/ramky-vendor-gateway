## Problem

In Step 1 (Documents → KYC), after entering MSME details (and similarly other unverified entries — Udyam number typed but not yet "Verified", or a certificate file picked but OCR not finished), if the user navigates to Organization (or any other step) and comes back via the previous button or top step indicator, the MSME tab is reset.

Root cause: Step 1's `DocumentVerificationStep` is conditionally rendered (`switch (currentStep) { case 1: ... }`) in `src/pages/VendorRegistration.tsx`. Leaving step 1 unmounts the component and destroys all its local React state. The parent's `verifiedData` only contains `msme` block when `msmeDoc.status === "verified"` (`buildOutput` in `DocumentVerificationStep.tsx` line 1736), and the manual Udyam number input (`msmeManualNumber`), in‑progress OCR data, and the picked file are not fully rehydrated from `initialData` on remount (`msmeDoc` init at line 411 only rebuilds from `initialData.msme`, ignoring `msmeCertificateFile`, partial OCR, manual entry, error messages, etc.).

## Fix

Keep `DocumentVerificationStep` mounted across step navigation so its in-progress KYC state (MSME and the other three tabs) is preserved when the user moves to Organization/Address/etc. and returns.

### Changes (single file: `src/pages/VendorRegistration.tsx`)

1. In `renderStep()` (domestic branch, around lines 1184–1195), stop rendering Step 1 inside the `switch`. Instead, always render `DocumentVerificationStep` once in the page (outside `renderStep`), wrapped in a `<div hidden={currentStep !== 1} aria-hidden={currentStep !== 1}>` (or `style={{ display: currentStep === 1 ? 'block' : 'none' }}`) so it stays mounted but is only visible on step 1.
2. The `switch` keeps cases 2..5 unchanged and returns `null` for `case 1` (it is rendered separately above).
3. Apply the same treatment to the international branch's Step 1 (`IntlDocumentsStep`) for consistency, since it has the same unmount-on-navigation risk.
4. No change to props, `verifiedData`, `handleDocStageChange`, `handleDocVerificationComplete`, or the autosave/draft pipeline — they continue to work because the component is still mounted and `onStageChange` keeps firing only when its local state actually changes.

### Out of scope

- No changes to `DocumentVerificationStep`'s internal state model, `buildOutput`, or KYC tab rehydration logic.
- No backend, schema, or edge-function changes.
- Other steps (Organization, Address, etc.) are not kept mounted — they already round-trip cleanly through `formData`/`onLiveUpdate`. Only Step 1 is affected by this bug.

### Verification

After the change: enter a Udyam number / pick an MSME certificate without clicking Verify → go to Organization → click Previous (or the Documents step in the top indicator) → the MSME tab should retain the entered number, the selected file, OCR preview, status pill, and the "Yes/No MSME registered" selection exactly as left.
