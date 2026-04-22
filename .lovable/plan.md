

## Show all extracted GST details after upload

### What the user is seeing today
After uploading the GST certificate, the verified panel only shows **5 fields**: Legal Name, Trade Name, GSTIN, Constitution, Principal Place of Business. The OCR (`ocr-extract` edge function) actually extracts many more fields, but the UI silently drops them.

### What the OCR already returns (but UI hides)
From `supabase/functions/ocr-extract/index.ts` GST schema:
- `gst_status` (Active / Cancelled / Suspended)
- `registration_date`
- `taxpayer_type` (Regular / Composition / SEZ)
- `business_nature` (array)
- `additional_places` (array)
- `jurisdiction_centre`
- `jurisdiction_state`

### Fix — render all extracted GST fields in the verified panel

**File: `src/components/vendor/steps/DocumentVerificationStep.tsx`**

In the GST `<DocSplitRow verifiedFields={...}>` block (around line 506), expand the read-only grid into a structured, enterprise-grade detail panel grouped into three sections:

1. **Identity** — Legal Name, Trade Name, GSTIN (mono), Constitution
2. **Registration** — GST Status (badge: green Active / red Cancelled / amber Suspended), Registration Date, Taxpayer Type, Business Nature (chip list)
3. **Place of Business** — Principal Place (existing editable input), Additional Places (chip list, only if any)
4. **Jurisdiction** — Centre Jurisdiction, State Jurisdiction

Each section gets a small heading and a 2-column grid of `ReadOnlyField`s for visual consistency with the rest of the form. Empty/missing fields are hidden so the panel stays clean when OCR couldn't read a value.

**Type updates** (same file):
- Extend `VerifiedDocumentData.gst` with `status`, `registrationDate`, `taxpayerType`, `businessNature`, `additionalPlaces`, `jurisdictionCentre`, `jurisdictionState`.
- Update `buildOutput()` to forward those fields to the parent so they flow into `formData.statutory.gst*` (which already has matching slots in `src/types/vendor.ts`).
- Update the `initialData?.gst` rehydration block so re-opening Step 1 shows the same details.

**File: `src/pages/VendorRegistration.tsx`**

In `applyVerifiedDataToForm` (the helper that maps `VerifiedDocumentData` → `formData.statutory`), copy the new GST fields onto the existing `statutory.gstStatus`, `gstRegistrationDate`, `gstTaxpayerType`, `gstBusinessNature`, `gstAdditionalPlaces`, `gstJurisdictionCentre`, `gstJurisdictionState` slots. No schema changes — these fields already exist on `StatutoryDetails`.

### Visual notes
- Use the existing `ReadOnlyField` component, plus a small inline status pill (`Active` → `bg-success/10 text-success`, `Cancelled` → `bg-destructive/10 text-destructive`, `Suspended` → `bg-warning/10 text-warning`).
- Render `business_nature` and `additional_places` arrays as `<span className="rounded-md bg-muted px-2 py-0.5 text-xs">` chips, wrapping naturally.
- Section headings use `text-xs font-medium uppercase tracking-wide text-muted-foreground`, matching the rest of the enterprise styling.

### Out of scope
- No change to OCR logic, dummy `verifyApi`, gating, tab auto-advance, or to PAN/MSME/Bank panels.
- No DB migrations — `vendors` table already has the matching columns and `useVendorRegistration.ts` already maps them.
- No real GST API call — continues to use the simulated dummy as previously agreed.

