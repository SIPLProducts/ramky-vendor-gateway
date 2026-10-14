# Keep the right GST / PAN / Bank document when OCR or verification fails

## Rules (same for GST, PAN and Bank)

| Situation | First upload (nothing saved yet) | Re-upload (verified document already saved) |
|---|---|---|
| OCR succeeds + verification succeeds | Unchanged: save document + data, tab Verified | Unchanged: replace with new document + data |
| OCR succeeds + verification fails | Save the document; tab stays Failed; manual popup opens | Keep old document + data; hold new file; manual popup opens |
| OCR fails | Hold the file; manual popup opens; nothing saved yet | Keep old document + data; hold new file; manual popup opens |
| Manual verification succeeds (after any failure above) | Save the held document + verified data; fill fields; tab Verified; Continue allowed | Replace old document + data with the new document + verified data |
| Manual verification fails or popup closed | OCR-failed file: not saved. OCR-passed file: stays saved, tab Failed | Old document + data kept unchanged |

**Unchanged on purpose**
- Real mismatches still block (PAN on card vs GSTIN PAN, account-holder name, MSME name).
- GST returns filing check runs only after GST verification succeeds.
- Tab is Verified and Continue is allowed only when verification returns full data.
- MSME, other tabs, approvals, SAP/DMS, emails untouched. GST/PAN/Bank numbers and "passed" statuses are written only after successful verification.

## Technical details

Files: `src/components/vendor/steps/DocumentVerificationStep.tsx`, `src/hooks/useVendorRegistration.tsx`, `src/pages/VendorRegistration.tsx` (first-time "clear section" decision only).

1. Per-tab held-file refs: `pendingGstFileRef`, `pendingPanFileRef` (Bank reuses `lastBankFileRef` / `lastBankFile2Ref`). Set on every upload attempt; cleared on new upload, Yes/No toggle, tab reset, or successful manual submit.
2. `DocState.ocrPassedFile?: File` — set only for a first-time upload whose OCR succeeded but verification failed; this is the one failed state whose file is lifted for saving.
3. `runDocFlow` failure branches:
   - Verification failure, no accepted doc → `{ status: "failed", errorMessage, file, fileName, fileSize, ocrPassedFile: file }`.
   - OCR failure / low confidence, no accepted doc → `{ status: "failed", errorMessage }` (file only in held ref).
   - Any failure with accepted verified doc → keep `acceptedDoc` + error (as today), new file only in held ref.
4. `handleGstManualSubmit` / `handlePanManualSubmit` / Bank popup submit: on success use the held file (fallback `prev.ocrPassedFile`, then `prev.file`) so the new document is saved with verified data; on failure leave state as is. Fixes today's bug where GST/PAN manual success kept the old file.
5. `buildOutput`: lift files when `verified` (as today) or when `failed` with `ocrPassedFile` and no previously saved document. Data payloads and `step1Status` stay verified-only.
6. Persistence: a first-time section with only `ocrPassedFile` is not added to document deletion in `kycClearSections` and not blocked in `uploadAllDocuments`; cleared/`failed` column values still apply. Existing replacement isolation keeps protecting saved documents.
7. Tests: pure helper `src/lib/kycDocRetention.ts` with tests beside existing `src/lib/*.test.js`, one per table row (e.g. first upload OCR fail + manual fail → not saved; re-upload OCR ok + verify fail → old kept; re-upload manual success → new replaces old).
8. Verify with build + browser run of the GST tab with a simulated verification failure. Deploy only the frontend to Quality/Production; no database or function changes.
