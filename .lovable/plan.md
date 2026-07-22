## Fix: Do not open PAN Manual Entry popup on PAN-vs-GSTIN mismatch

### Problem
When the PAN extracted from the uploaded PAN card doesn't match the PAN derived from GSTIN (e.g. `AAHFO8598G` vs `AAZFR3901L`), `DocumentVerificationStep.tsx` currently opens the "Enter PAN manually" popup. This lets a vendor type the GST-derived PAN, bypass the check, and proceed with a PAN document belonging to a different entity.

### Root cause
In `runDocFlow` (around line 1285–1288), any `verifyApi("pan")` failure opens the manual popup. `verifyApi` for `pan` (line 904–908) returns this specific mismatch as a verification failure, so it falls into the same branch as OCR/read failures.

### Change
In `src/components/vendor/steps/DocumentVerificationStep.tsx`, inside the `kind === "pan"` failure branch of `runDocFlow`:

- Detect the PAN-vs-GSTIN mismatch by matching the message returned from `verifyApi` (`"does not match PAN derived from GSTIN"`).
- When matched: keep the existing `setDoc({ status: "failed", ... errorMessage: msg })` inline error (already shown under the file pill and in the alert) and simply skip the `openPanManualPopup(...)` call. Vendor must upload the correct PAN document to proceed.
- All other PAN verification failures (invalid/unreadable PAN, PAN Comprehensive rejected, provider not configured, etc.) continue to open the manual entry popup exactly as today.

No other flows (GST, MSME, Bank) or OCR failure branches are touched.

### Files
- `src/components/vendor/steps/DocumentVerificationStep.tsx` — one guarded conditional around the `openPanManualPopup(msg, pan)` call at ~line 1287.
