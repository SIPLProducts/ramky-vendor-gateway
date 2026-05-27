# Fix Plan: Classification, Review navigation, CEO fields, Template label

No existing functionality is changed except the points below. International flow, SAP sync payload, bulk sync, and all other screens stay as-is.

## Point 1 — Classification handled in SAP Sync (domestic only)

### Remove from domestic registration
- File: `src/components/vendor/steps/OrganizationStep.tsx`
  - Remove the entire "SAP Classification" block (lines ~458–528) including the four `ClassificationField` multi-selects (`material_group_vendor`, `vendor_category`, `vendor_location`, `identification_source`) and the section header.
  - Keep all other fields and their state untouched. International (`IntlClassificationStep`) is NOT touched.
- File: `src/pages/VendorRegistration.tsx`
  - In `filledSteps` calc (~line 401) leave international step-4 detection unchanged; only stop using classification as a domestic completeness requirement (no change needed since domestic doesn't have step 4 = Classification).
- File: `src/hooks/useVendorRegistration.tsx`
  - Keep the columns `material_group_vendors`, `vendor_categories`, `vendor_locations`, `identification_sources` in the payload. For domestic they will simply submit as empty arrays (since the UI no longer collects them). International flow keeps populating them.

### Make Classification editable on SAP Sync screen
- File: `src/components/sap/SapFieldsDialog.tsx`
  - Replace the four `ReadOnlyField`s in the Classification section with multi-select dropdowns backed by SAP F4 master data:
    - `material_group_vendor` → MGV
    - `vendor_category` → CATV
    - `vendor_location` → LOCV
    - `identification_source` → IDS
  - Options come from the live F4 data already fetched (`liveF4`) or the cached `useSapMasterData` fallback — same pattern the other F4 selects already use.
  - Reuse the existing `MultiSelect` component (`src/components/ui/multi-select.tsx`) so the user can add/remove items and the values are stored in `form.classify.{MGV|CATV|LOCV|IDS}` exactly as today.
  - Initial values: prefer what's already on the vendor row (existing `buildDefaults` logic). For domestic vendors with no classification yet, these will start empty and the SAP Team picks them here.
  - Update the helper note under the section to: "Select Classification values to send to SAP. Defaults are pre-filled when available."
- File: `src/pages/SAPSync.tsx`
  - In `handleConfirmSync` / `handleMultipleSync`, after a successful sync also persist the chosen classification arrays back to the `vendors` row so they stay associated with the vendor:
    - `material_group_vendors = overrides.classify.MGV`
    - `vendor_categories = overrides.classify.CATV`
    - `vendor_locations = overrides.classify.LOCV`
    - `identification_sources = overrides.classify.IDS`
  - Done via a single `supabase.from('vendors').update(...).eq('id', vendor.id)` before/after the sync mutation. Bulk sync applies the same arrays to each selected vendor.
- The edge function `sync-vendor-to-sap` already consumes `overrides.classify.*` — no changes there.

### CEO fields not mandatory
- File: `src/components/vendor/steps/ContactStep.tsx`
  - Change schema:
    - `ceoName: z.string().optional()` (remove `min(2)`)
    - `ceoPhone: phoneOptional`
    - `ceoEmail: z.string().email().optional().or(z.literal(''))`
  - Remove the red asterisks on the labels for Name, Contact Number 1, Email Address 1, and the section title "CEO / Managing Director *" → "CEO / Managing Director".
  - Remove the placeholder N/A / dummy auto-fills (`setValue('ceoName', 'N/A')`, etc.) since the fields are now optional.

## Point 2 — Review & Submit "Edit" deep-links to the right tab

Today every Edit in the domestic Review jumps to step 1 (Document Verification) which always opens on the GST tab — that's why everything looks like it lands on PAN/GST.

- File: `src/components/vendor/steps/ReviewStep.tsx`
  - Extend the `SectionHeader` / `onEdit` API to accept an optional target tab key (`"gst" | "pan" | "msme" | "bank"`) and pass it for the relevant sections:
    - Compliance & Statutory → step 1, tab `pan` (PAN is the entity-type/PAN data) — but split: GST sub-rows when present → tab `gst`; MSME rows → tab `msme`. Simplest: keep one "Compliance & Statutory" edit going to `pan`, and add a separate "GST Details" edit row (step 1, tab `gst`) and "MSME Details" edit row (step 1, tab `msme`) when those blocks render.
    - Bank Details → step 1, tab `bank`.
    - Organization, Address, Contact, Financial → existing steps 2/3/4/5 (no tab needed).
- File: `src/pages/VendorRegistration.tsx`
  - Update `handleEditStep` to also accept an optional tab key and stash it (e.g. `setPendingDocTab(tab)`), then `setCurrentStep(step)`.
- File: `src/components/vendor/steps/DocumentVerificationStep.tsx`
  - Accept a new optional prop `initialTab?: TabKey`. In the existing `useState<TabKey>('gst')` initializer use `initialTab ?? 'gst'`. Also add a `useEffect` that re-syncs `activeTab` when `initialTab` changes (so subsequent edits jump correctly).
  - Pass the prop through from `VendorRegistration.tsx` when rendering step 1.

No change to the existing intra-step auto-advance logic.

## Point 3 — Rename "Template" → "Template download" on GST/MSME tabs

- File: `src/components/vendor/steps/DocumentVerificationStep.tsx` lines 1877 and 2052
  - Change the button/link label `Template` to `Template download`. No behaviour change.

## Out of scope / unaffected
- International registration (`IntlClassificationStep`) stays unchanged.
- DB schema, RLS, edge functions, middleware, tenants/SAP API endpoints — untouched.
- `sapPayloadBuilder`, bulk sync edge function — already read from `overrides.classify`, no change.
- Existing vendors that already have classification values continue to pre-populate the new SAP Sync dropdowns.

## Technical notes
- Files touched (frontend only):
  1. `src/components/vendor/steps/OrganizationStep.tsx` — remove Classification block.
  2. `src/components/vendor/steps/ContactStep.tsx` — CEO fields optional.
  3. `src/components/vendor/steps/ReviewStep.tsx` — add tab targets in section headers; split GST/MSME edit rows.
  4. `src/components/vendor/steps/DocumentVerificationStep.tsx` — accept `initialTab` prop; rename "Template" → "Template download" (2 places).
  5. `src/pages/VendorRegistration.tsx` — thread `initialTab` and new `handleEditStep(step, tab?)`.
  6. `src/components/sap/SapFieldsDialog.tsx` — replace 4 ReadOnly fields with MultiSelect F4-backed dropdowns; update helper text.
  7. `src/pages/SAPSync.tsx` — persist chosen classification arrays to `vendors` on confirm (single + bulk).

No DB migration, no edge-function change, no breakage to tenants/F4 APIs.
