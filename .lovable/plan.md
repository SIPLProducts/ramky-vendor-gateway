# Keep the uploaded GST / PAN / Bank document when OCR reads it but verification fails

## What changes for the vendor

**First-time upload (no document saved yet for that tab)**
- OCR fails → same as today: document not saved, manual-entry popup opens.
- OCR succeeds, verification fails (e.g. "Internal Server Error Occurred") → the uploaded PDF/image is now **saved** with the draft. The tab still shows Failed, and the manual-entry popup opens (GSTIN / PAN / Account + IFSC).
- Vendor enters the number and clicks Submit → it is verified as today. Only when verification returns full data are the fields filled in, the tab turns green, and the vendor can continue. The already-saved document stays attached to that tab.
- OCR + verification both succeed → unchanged.

**Edit / re-upload (a verified document is already saved)**
- OCR fails → previous document and data stay exactly as they are (unchanged from today).
- OCR succeeds, verification fails → previous document and data stay; the new file is held in the background and the manual popup opens.
- Manual Submit succeeds → the **new** file and the new verified data replace the old ones together. (Today GST/PAN manual Submit keeps the old file by mistake; this is fixed.)
- Manual Submit fails or popup is closed → nothing is replaced.

**Unchanged on purpose**
- Real mismatches still block (PAN on card ≠ PAN in GSTIN, account-holder name mismatch, MSME name mismatch) — no unverified saving for those.
- GST returns filing check runs only after GST verification succeeds, exactly as today.
- MSME flow, other tabs, Continue gating, approvals, SAP/DMS, and emails are not touched.
- The vendor's saved GST/PAN/Bank numbers and statuses are only written after successful verification; a first-time failure keeps status "failed" with the fields empty, but the document is retained.

## Technical details

Files: `src/components/vendor/steps/DocumentVerificationStep.tsx`, `src/hooks/useVendorRegistration.tsx`, `src/pages/VendorRegistration.tsx` (only where first-time "clear section" is decided).

1. `DocState` gets an optional `ocrPassedFile?: File` (new file whose OCR succeeded but verification failed).
2. `runDocFlow` → verification-failure branch (`!v.ok`) only:
   - No accepted doc: set `{ status: "failed", errorMessage, file, fileName, fileSize, ocrPassedFile: file }` instead of dropping the file.
   - Accepted verified doc: keep `acceptedDoc` + error message (as today) and store the new file in a per-tab pending ref (`pendingGstFileRef`, `pendingPanFileRef`; Bank already uses `lastBankFileRef` / `lastBankFile2Ref`).
   - OCR-failure and low-confidence branches stay as they are.
3. `handleGstManualSubmit` / `handlePanManualSubmit`: on success use `pendingRef.current ?? prev.ocrPassedFile ?? prev.file`, then clear the pending ref. Clear the pending ref on any new upload, Yes/No toggle, or tab reset. Bank manual submit already uses the latest cheque file — verify behaviour, no logic change.
4. `buildOutput`: lift `gstCertificateFile` / `panCardFile` / `cancelledChequeFile(2)` when status is `verified` (as today) **or** when status is `failed` with `ocrPassedFile` set and there is no previously saved document for that tab. `step1Status` and the GST/PAN/Bank field payloads stay verified-only.
5. Persistence: for a section whose only change is an `ocrPassedFile`, do not add it to `kycClearSections` document deletion and do not block its upload in `uploadAllDocuments`; still apply the cleared/`failed` column values for that tab. Existing replacement isolation (`pendingKycSections`, `isolateKycReplacementPayload`) keeps protecting previously saved documents.
6. Tests: add a small pure helper (e.g. `src/lib/kycDocRetention.ts`) deciding "lift file?" and "replace saved doc?", with tests next to existing `src/lib/*.test.js`:
   - first upload, OCR ok + verify fail → file lifted, tab not complete
   - first upload, OCR fail → file not lifted
   - existing saved doc, OCR ok + verify fail → saved doc kept, new file not lifted
   - existing saved doc, manual submit success → new file replaces old
   - existing saved doc, manual submit fail → old kept
7. Verify with type check/build and a browser run of the registration GST tab using a simulated verification failure; live provider and Quality/Production checks remain for you after deploying the frontend (no database or function deployment needed).
