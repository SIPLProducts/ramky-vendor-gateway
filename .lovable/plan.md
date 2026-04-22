
## Fix Step-1 deadlock so green verification always enables Continue and Save Draft

### Root cause
Step 1 currently has two different sources of truth:

- `DocumentVerificationStep` shows the green/verified state from its **local doc state**
- The outer action bar (`Continue`, `Save Draft`) depends on **parent state** (`verifiedData` + `formData`)

Those two can drift. In the current code:

1. The child only lifts extracted values, not the actual uploaded files.
2. The parent re-derives “can proceed” from partial data instead of using the child’s real completion state.
3. `Save Draft` uses the parent `formData` snapshot, which can be one render behind the latest Step-1 OCR/edit state.

So the UI can show all green in Step 1 while the parent still thinks Step 1 is incomplete, and draft save can run with stale/incomplete data.

### What to change

#### 1. Make Step 1 emit one authoritative snapshot
File: `src/components/vendor/steps/DocumentVerificationStep.tsx`

Extend the Step-1 payload so the child sends everything the parent actually needs:

- extracted/corrected OCR values
- uploaded file objects for GST / PAN / MSME / cancelled cheque
- explicit stage-completion metadata:
  - `stage1Done`
  - `stage2Done`
  - `stage3Done`
  - `stage4Done`
  - `allDone`

Implementation changes:
- Add `file?: File` to `DocState`
- Save the uploaded `File` in `runDocFlow(...)`
- Extend `VerifiedDocumentData` with:
  - `gstCertificateFile?: File | null`
  - `panCardFile?: File | null`
  - `msmeCertificateFile?: File | null`
  - `cancelledChequeFile?: File | null`
  - `step1Status?: { stage1Done: boolean; stage2Done: boolean; stage3Done: boolean; stage4Done: boolean; allDone: boolean }`
- Include those fields in `buildOutput()`

This makes the Step-1 payload the real source of truth instead of forcing the parent to guess from fragments.

#### 2. Parent should merge the Step-1 snapshot into a draft-safe form object
File: `src/pages/VendorRegistration.tsx`

Refactor the current mapping logic into a pure helper:

- `mergeVerifiedDataIntoForm(prevFormData, verifiedData): VendorFormData`

That helper should map:
- organization legal/trade names
- statutory GST/PAN/MSME values
- bank values
- Step-1 uploaded files:
  - `gstCertificateFile`
  - `panCardFile`
  - `msmeCertificateFile`
  - `cancelledChequeFile`

Then:
- `handleDocStageChange` updates a `latestStep1DataRef`
- `handleDocStageChange` only calls `setVerifiedData` / `setFormData` when the merged values actually changed
- `handleDocVerificationComplete` reuses the same merge helper, then advances to Step 2

This removes duplication and keeps draft save + continue aligned.

#### 3. Stop re-deriving completion in the parent
File: `src/pages/VendorRegistration.tsx`

Update `canProceedFromCurrentStep()` for Step 1 to use the child’s explicit completion result:

- Prefer `verifiedData?.step1Status?.allDone`
- Keep the old field-based fallback only as a defensive backup

This ensures:
- if the child shows all 4 tiles green, the parent action bar also enables
- no mismatch between local child state and outer footer state

#### 4. Save Draft should save the freshest Step-1 data, not a stale render snapshot
File: `src/pages/VendorRegistration.tsx`

Change `handleSaveAsDraft()` so when `currentStep === 1` it builds the payload from the latest lifted Step-1 snapshot before calling `saveVendor(...)`.

Pattern:
- read `latestStep1DataRef.current`
- build `draftPayload = mergeVerifiedDataIntoForm(formData, latestStep1DataRef.current)`
- pass `draftPayload` to `saveVendor(draftPayload)`

Also update `lastSavedHashRef` using that same final payload.

This fixes the case where the user clicks Save Draft immediately after the last verification/edit and the parent state has not fully flushed yet.

#### 5. Prevent autosave/button churn from no-op state writes
Files:
- `src/pages/VendorRegistration.tsx`
- optionally `src/components/vendor/steps/DocumentVerificationStep.tsx`

Guard against repeated identical updates:
- do not call `setVerifiedData` if the new Step-1 snapshot is materially unchanged
- do not call `setFormData` if the merged result is the same as the previous form state

That reduces unnecessary autosaves and avoids keeping the footer in a “saving/pending” loop.

### Files to edit
- `src/components/vendor/steps/DocumentVerificationStep.tsx`
  - store uploaded `File` objects in doc state
  - extend `VerifiedDocumentData`
  - emit `step1Status` + file objects from `buildOutput()`

- `src/pages/VendorRegistration.tsx`
  - add `mergeVerifiedDataIntoForm(...)`
  - add `latestStep1DataRef`
  - update `handleDocStageChange`
  - update `handleDocVerificationComplete`
  - update `canProceedFromCurrentStep()`
  - update `handleSaveAsDraft()` to save the merged latest Step-1 payload

### Result after the fix
- When all four Step-1 checks are green, `Continue` enables reliably
- Clicking `Continue` advances to Step 2 reliably
- `Save Draft` saves the latest OCR/manual-correction values reliably
- Uploaded Step-1 files are carried into the form state, so draft saves include the actual documents too
- The green state in Step 1 and the footer button state stay in sync

### Out of scope
- No OCR extraction logic changes
- No backend schema changes
- No workflow or approval changes
- No changes to steps 2–8 except consuming the corrected Step-1 data
