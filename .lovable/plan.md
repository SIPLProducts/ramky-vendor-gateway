## Cascade document resets in Document Verification step

When a parent document (GST → PAN → MSME → Bank) is uploaded, replaced, or reset, all dependent documents and their stored data must be cleared. File: `src/components/vendor/steps/DocumentVerificationStep.tsx`.

### Dependency chain
- GST → resets PAN + MSME + Bank
- PAN → resets MSME + Bank
- MSME → resets Bank
- Bank → resets its own previously verified data (and the secondary cheque slot)

### Implementation

1. **Add a `resetDependents` helper** (placed near the existing toggle handlers around line 1094):
   - `resetPan()` → `setPanDoc(idleDoc); setPanCrossCheckError(null);`
   - `resetMsme()` → `setMsmeDoc(idleDoc); setMsmeManualNumber(""); setMsmeManualError(null); setMsmeDeclarationFile(null); setMsmeDeclarationReason(""); setIsMsmeRegistered(null);`
   - `resetBank()` → `setBankDoc(idleDoc); setBankDoc2(idleDoc); lastBankFileRef.current = null; lastBankFile2Ref.current = null;` (also close any open `bankPopup`)
   - `resetGstAux()` → clears `gstDeclarationFile`, `gstDeclarationReason`, `editablePrincipalPlace`, `gstFilingRows`, `gstFilingChecked`, `gstLatestFiled`.

2. **Hook into upload handlers** (called from `FileUpload` when a new file is selected — this covers both first upload and replace):
   - `handleGstUpload` (line 1159): before running OCR, call `resetPan(); resetMsme(); resetBank();`
   - `handlePanUpload` (line 1191): call `resetMsme(); resetBank();`
   - `handleMsmeUpload` (line 1211) and `handleMsmeManualValidate` (line 1226): call `resetBank();`
   - `handleBankUpload` (line 1310): clear previous primary bank verification (`setBankDoc(idleDoc); lastBankFileRef.current = null;`) before starting the new flow. `handleBankUpload2` similarly clears secondary slot.

3. **Hook into the Reset buttons** (the `onReset` props on `DocSplitRow`):
   - GST reset (line 1958): `setGstDoc(idleDoc); resetGstAux(); resetPan(); resetMsme(); resetBank();`
   - PAN reset (line 2129): existing reset + `resetMsme(); resetBank();`
   - MSME reset (line 2471 inline reset button): existing reset + `resetBank();`
   - Bank reset (line 2524): keep current `setBankDoc(idleDoc)` and also clear `lastBankFileRef.current`. Bank secondary reset (line 2664) similarly clears `lastBankFile2Ref.current`.

4. **Toggle handlers**: extend `handleGstRegisteredChange` to also call `resetPan(); resetMsme(); resetBank();` so flipping Yes/No on the GST question cascades the same way. Extend `handleMsmeRegisteredChange` to also call `resetBank();`.

5. **No backend / schema changes.** Final persistence already happens through `useVendorRegistration`; clearing the in-memory doc state means the next save will overwrite/clear the stored dependent documents and OCR rows the same way an empty submission does today.

### Behaviour after change
Whenever a vendor uploads or replaces GST, the previously verified PAN, MSME (manual + uploaded) and Bank data disappear from the UI and from the next save payload. The same cascade applies down the chain for PAN, MSME and Bank, preventing stale dependent data after a parent document changes.