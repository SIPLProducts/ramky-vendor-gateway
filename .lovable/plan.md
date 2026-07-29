## Goal

1. Make **Legal Name of Organization** and **Trade Name / Brand Name** on the Organization Profile step **read-only and always driven by the GST Verification API response**. If GST is not registered, fall back to the **PAN Holder Name** from the PAN Verification API.
2. When a vendor uploads / replaces / re-verifies a GST document, **fully reset every GST-derived field** (address, city, district, state, country, pincode, industry/organization/ownership types, etc.) before the new GST response is applied — so no data from the previous GST persists.

## Changes

### 1. `src/pages/VendorRegistration.tsx` → `mergeVerifiedDataIntoForm`

- Change GST-derived fields from `fill` (fill-only-if-empty) to `overwrite` (latest verified wins) so a new GST upload overrides stale values. This applies to:
  - `organization.legalName`, `organization.tradeName`, `organization.state`
  - `address.registeredAddress`, `registeredCity`, `registeredState`, `registeredPincode`
- Extend the existing `gstChanged` detection to also detect **GST reset / re-verification** (verified-timestamp bump or verified-flag flip), and when it fires, **clear the following before merging**: `registeredAddress`, `registeredCity`, `registeredDistrict`, `registeredState`, `registeredCountry`, `registeredPincode`, plus `organization.legalName`, `organization.tradeName`, `organization.state`, and any downstream statutory GST fields already handled below. (Country defaults to India for domestic.)
- Legal Name precedence: `data.gst?.apiName || data.gst?.legalName` when GST=Yes → else `data.pan?.apiName || data.pan?.holderName` → else `data.manualLegalName`. Trade Name precedence: `data.gst?.tradeName` when GST=Yes → else `data.pan?.apiName || data.pan?.holderName` (per requirement "if gst not there then these should be pan holder name").
- When GST=No, keep the existing manual-address behavior intact (no change to non-GST flows).

### 2. `src/components/vendor/steps/OrganizationStep.tsx`

- Make **Legal Name** and **Trade Name** inputs `readOnly` whenever GST is verified (`statutoryData.isGstRegistered === true && statutoryData.gstin`) OR when PAN has been verified (`statutoryData.pan && statutoryData.panHolderName`). Style with the same muted / verified appearance already used for other auto-filled fields (`bg-muted/40 cursor-not-allowed`).
- Add a small helper caption under each field ("Auto-filled from GST Verification" / "Auto-filled from PAN Verification") so vendors understand why it is locked.
- Keep the fields editable only when neither GST nor PAN has been verified (edge case: draft loaded without either).

### 3. `src/components/vendor/steps/DocumentVerificationStep.tsx`

- In `handleGstUpload` (and the manual-GST submit path `handleGstManualSubmit`), before running OCR/verify, **reset all GST-derived local state** to defaults: `setGstDoc(idleDoc)`, `setEditablePrincipalPlace('')`, `setGstFilingRows([])`, `setGstCompliance(null)`, `gstFilingChecked=false`, so that the child never emits a `VerifiedDocumentData` that mixes old + new GST fields.
- The child already emits `handleDocStageChange` after every state change; the parent overwrite logic in step 1 will then propagate the reset to the form.

### 4. No changes to

- SAP / DMS payload builders (they read from form state, which is refreshed above).
- Bank, PAN, MSME upload flows.
- Approval / Buyer re-approval screens.

## Technical notes

- `mergeVerifiedDataIntoForm` currently has partial `gstChanged` logic that clears only `organization.{legalName, tradeName, state}`. We are widening the reset to the full GST-derived surface and switching to `overwrite` for those keys so the next merge unconditionally uses the latest GST response.
- Read-only is enforced in the UI layer only; validation (`zod` schemas) already accepts any non-empty string, so no schema changes.
- Country defaults: the address step already defaults `registeredCountry` to "India" for domestic — reset restores that default rather than blanking it.

## Out of scope

- Vendor Type / International flow (no GST there).
- Approver-side screens (they display persisted values only; they will naturally reflect the latest GST once the vendor re-submits).
