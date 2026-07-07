# Fix "PAN Status shows Invalid" in Edit + Preview

## Root cause

Three independent bugs conspire to flip a saved-Valid PAN to "Invalid":

1. **`formatPanStatus(null)` returns `"Invalid"`** (`src/lib/panComprehensive.ts`). Any screen that reads `vendor.pan_status` directly (Preview dialog, Finance, DocumentVerification, Reports, Purchase Approval) shows "Invalid" whenever the DB field is null/blank — even when the vendor was actually verified. `VendorReviewDialog` avoids this only because it has a fallback to `pan_verification_status`. Same issue for `formatAadhaarLinked(null)` → "Aadhaar Not Linked with PAN".

2. **PAN Tab (edit) never hydrates from saved values.** `ComplianceStep` initializes `panTabResult` to an empty record. On opening an existing vendor's edit → PAN tab, the tab's local `panStatus` is `null`, so the status card (when rendered) prints "Invalid". It never reads `data.panStatus` / `data.panAadhaarLinked` that `useVendorRegistration` already hydrates.

3. **Save can wipe the saved value.** In `useVendorRegistration.tsx` the update payload sends `pan_status: formData.statutory.panStatus ?? null`. If the buyer edits and saves before (or without) re-running PAN Comprehensive, and the form field is null for any reason, the DB Valid gets overwritten to null. Preview then reads null → "Invalid".

## Changes

### 1. `src/lib/panComprehensive.ts`
Return a neutral value when the API result is unknown, so "Invalid" is only shown when the registry explicitly said so.

- `formatPanStatus`:
  - null / undefined / empty string → `'-'`
  - lower(status) === `'valid'` → `'Valid'`
  - anything else → `'Invalid'`
- `formatAadhaarLinked`:
  - `true` → `'Aadhaar Linked with PAN'`
  - `false` → `'Aadhaar Not Linked with PAN'`
  - null / undefined → `'-'`

### 2. `src/components/vendor/steps/ComplianceStep.tsx`
Seed `panTabResult` from the form data so the PAN tab reflects the saved verification when opened in edit:

```ts
const [panTabResult, setPanTabResult] = useState<PanTabResult>({
  ocrPan: data.pan || '',
  ocrName: data.panHolderName || '',
  panCheck: 'idle',
  nameCheck: 'idle',
  panStatus: data.panStatus ?? null,
  aadhaarLinked: data.panAadhaarLinked ?? null,
});
```

### 3. `src/components/vendor/kyc/PanKycTab.tsx`
- Ensure the "PAN Status / Is Aadhaar Linked" card renders whenever there is a saved `panStatus` or `aadhaarLinked` (already does, but verify the condition covers hydrated state without OCR re-run).
- In `runPanComprehensive`, only overwrite `panStatus` / `aadhaarLinked` when we receive a definitive value. If the call fails or the fields are missing, keep the previously hydrated values (do not push `null` into state or DB). Concretely: skip the `updateResult` and the `supabase.update` when both `rawStatus` and parsed `aadhaarLinked` are null/undefined.

### 4. `src/hooks/useVendorRegistration.tsx` (save payload, ~line 511-515)
Do not overwrite existing PAN Comprehensive fields with null. Only include them in the update payload when the form actually holds a value:

```ts
...(formData.statutory.panStatus != null ? { pan_status: formData.statutory.panStatus } : {}),
...(formData.statutory.panAadhaarLinked != null ? { pan_aadhaar_linked: formData.statutory.panAadhaarLinked } : {}),
...(formData.statutory.panComprehensiveVerifiedAt != null ? { pan_comprehensive_verified_at: formData.statutory.panComprehensiveVerifiedAt } : {}),
```

For a brand-new vendor row (insert path, if separate), preserve the current behaviour of writing null.

## Screens that will now display correctly

Preview (`VendorSubmissionPreviewDialog`), View Details (`VendorReviewDialog`), PAN Tab (`PanKycTab` in edit), Finance Review, Document Verification, Purchase Approval, Reports, Vendor List export — they all funnel through `formatPanStatus` / `formatAadhaarLinked` and the DB `pan_status` field, which will no longer be silently wiped or mis-formatted.

## Validation

1. Open an existing verified vendor → Buyer Edit → PAN tab shows PAN Status = **Valid** (from hydrated state), no re-verification required.
2. Preview from SAP Sync for the same vendor → PAN Status = **Valid**.
3. Save the edit without re-running PAN Comprehensive → DB `pan_status` stays `valid`; reopen View Details → still Valid.
4. New vendor that has never run PAN Comprehensive → all screens show `-` (not "Invalid").
5. Vendor where registry explicitly returned a non-valid status → screens show "Invalid".
