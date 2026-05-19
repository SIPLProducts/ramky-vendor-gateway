## Problem

Clicking **Back** from the registration screen only returns the user to the Vendor Type selector — it does NOT clear the current slice or purge uploaded documents. So when the user goes Domestic → International, uploads Registration Copy + SWIFT/IBAN, then clicks **Back** and re-enters the flow (whether they pick the same type or switch), residual fields and previously uploaded files are still attached because:

1. `Back` only flips `vendorTypeChosen = false` — no reset, no purge.
2. `handleVendorTypeChange` early-returns when `next === formData.vendorType`, so re-selecting the same type after Back keeps everything.
3. The auto-save loop may have already persisted the partial data, and on the next field touch it gets re-saved on top of any reset done elsewhere.
4. `IntlDocumentsStep` / `DocumentVerificationStep` previews are driven by `data.*File` / `verifiedData`, which must be empty objects after reset (currently are, but only along the partial path).

## Fix

File: `src/pages/VendorRegistration.tsx` only.

### 1. Make Back fully reset + purge

Replace the Back button click handler with a new `handleBackToTypeSelector()` that:

- Calls `applyVendorTypeSwitch(formData.vendorType)` **forcing** the reset path (see #2) — clears both domestic and international slices, `completedSteps`, `currentStep=1`, `verifiedData`, `customFieldValues`, `latestStep1DataRef`, declaration.
- Awaits `purgeVendorArtifacts(vendorId)` if a draft exists, so storage + `vendor_documents` rows are wiped before the selector re-opens.
- Cancels any pending auto-save timer (`clearTimeout(autoSaveTimerRef.current)`) and sets `autoSaveState = 'idle'` so a stale debounce doesn't re-persist the old payload.
- Sets `setVendorTypeChosen(false)` and `setPendingChoiceType(formData.vendorType)` last.
- Shows a toast: "Previous data cleared. Choose vendor type to start fresh."

### 2. Always reset on selector choice (remove same-type early return)

In `handleVendorTypeChange(next)`:

- Drop the `if (next === formData.vendorType) return;` guard.
- Always call `applyVendorTypeSwitch(next)` so picking the same type after Back also produces a clean slate (defence in depth in case Back was bypassed).

### 3. Make `applyVendorTypeSwitch` purge synchronously before continuing

- Change `purgeVendorArtifacts` invocation from fire-and-forget to `await`ed inside an async `applyVendorTypeSwitch`, so the next render of the step components mounts against an empty storage state.
- Also delete `vendor_validations` / `verified_documents` rows for `vendorId` (best-effort) so Step 1 KYC tabs reload empty.
- Null out type-specific columns on the `vendors` row in a single update (legal_name, pan, gstin, bank_*, international_* etc.) so the draft persisted in DB matches the cleared UI.

### 4. Reset uploaded-file UI state explicitly

- Pass a stable empty-object reference (`EMPTY_INTERNATIONAL_DATA.documents`) into `IntlDocumentsStep` after reset, and `verifiedData={undefined}` into `DocumentVerificationStep`, so their internal previews drop.
- `FileUpload` already reflects `currentFile` — confirm by snapshotting `key={formData.vendorType + resetNonce}` on the step container; bump a `resetNonce` counter inside `applyVendorTypeSwitch` to force remount of step subtrees (cheapest way to drop any local preview state).

### 5. Cleanup dead code

- Remove `hasDomesticData`, `hasInternationalData`, `pendingTypeSwitch` and the obsolete confirmation `AlertDialog` if still present — Back already wipes, so no confirmation is needed.

## Out of scope

- No schema changes.
- No edge function changes.
- No changes to KYC, SAP master, or approval logic.
- No other files touched.
