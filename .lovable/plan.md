

## Conditional GST/MSME Registration + Expanded GST Certificate Capture

### Part A — Conditional GST & MSME flow

#### GST block

```text
Are you GST registered?  ( ) Yes   ( ) No

If YES:
  - GSTIN (mandatory, OCR + API verification — current behaviour)
  - GST certificate upload
  - Auto-capture extended fields (see Part B)

If NO:
  - Notice: "Download the GST Self-Declaration form, sign it, and upload"
  - [Download GST Self-Declaration Template] button (PDF in /public/templates/)
  - Signed declaration upload (mandatory)
  - Reason for non-registration (optional text)
  - GST + name-match validations skipped in orchestrator
```

#### MSME block

```text
Are you MSME registered?  ( ) Yes   ( ) No

If YES:
  - MSME category (Micro / Small / Medium)
  - Udyam / MSME number (mandatory, API verification)
  - MSME certificate upload

If NO:
  - No further fields
  - MSME validation skipped
```

### Part B — Expanded GST certificate data capture

When a vendor uploads a GST certificate, OCR + the form must capture and persist these additional fields from the certificate:

- Legal Name
- Trade Name
- Constitution of Business (Private Limited, LLP, Partnership, Proprietorship, etc.)
- Principal Place of Business — full address
- Additional Place(s) of Business (multi-line / array)
- Date of Registration
- GSTIN Status (Active / Cancelled / Suspended)
- Taxpayer Type (Regular / Composition / SEZ / Casual)
- Nature of Business Activities (multi-select from certificate)
- Jurisdiction — Centre
- Jurisdiction — State

These will be:
- auto-filled from OCR (`ocr-extract` GST schema extended)
- auto-verified against the GST API response where overlap exists
- shown read-only with an "Edit" toggle for vendor correction
- displayed in `ReviewStep` and `FinanceReview`

### Backend work

1. **Schema migration — `vendors` table additions**
   - `is_gst_registered boolean default true`
   - `gst_declaration_reason text`
   - `is_msme_registered boolean default false`
   - `gst_constitution_of_business text`
   - `gst_principal_place_of_business text`
   - `gst_additional_places jsonb`
   - `gst_registration_date date`
   - `gst_status text`
   - `gst_taxpayer_type text`
   - `gst_business_nature text[]`
   - `gst_jurisdiction_centre text`
   - `gst_jurisdiction_state text`

   (Existing `gstin`, `msme_number`, `msme_category` stay; nullable when flags false.)

2. **Storage**
   - Reuse `vendor-documents` bucket
   - New `document_type = 'gst_self_declaration'` row in `vendor_documents`

3. **Edge function updates**
   - `supabase/functions/ocr-extract/index.ts` — extend GST schema to return all Part B fields
   - `supabase/functions/validate-gst/index.ts` — return the same fields in `data`
   - `supabase/functions/validation-orchestrator/index.ts` — skip GST + name-match if `is_gst_registered=false`; skip MSME if `is_msme_registered=false` (mark as `skipped`, not `failed`)

4. **Static asset**
   - `public/templates/gst-self-declaration.pdf` — generated once with Sharvi/tenant branding placeholders

### Frontend work

1. **`src/components/vendor/steps/ComplianceStep.tsx`** (or `CommercialStep.tsx` — wherever GST/MSME live)
   - Add `RadioGroup` "Are you GST registered?"
   - Conditional render: GSTIN + verification + extended GST fields  **OR**  declaration download + upload + reason
   - Add `RadioGroup` "Are you MSME registered?"
   - Conditional render: MSME number + category + cert  **OR**  nothing
   - Update Zod schema for conditional requireds

2. **GST extended-fields panel** (new sub-component inside the step)
   - Renders Legal Name, Trade Name, Constitution, Principal Address, Additional Places, Reg Date, Status, Taxpayer Type, Business Nature, Jurisdictions
   - Auto-populated from OCR + API
   - Each field has read-only by default, "Edit" toggle for manual correction

3. **`src/components/vendor/steps/ReviewStep.tsx`**
   - GST section shows either "Registered — GSTIN + extended fields" or "Not registered — declaration on file ✓"
   - MSME section shows "Registered — Micro/Small/Medium + Udyam #" or "Not registered"

4. **`src/types/vendor.ts`** — extend `ComplianceDetails` with new flags and GST extended fields

5. **`src/hooks/useVendorRegistration.tsx`** — persist new flags, declaration reason, and extended GST fields

6. **`src/pages/FinanceReview.tsx`** — surface the new GST fields and registration-status flags for reviewers

7. **`src/components/admin/ValidationConfigManager.tsx`** — small note that GST/MSME validations auto-skip when vendor declares "No"

### Files touched

- new migration: vendor columns above
- new asset: `public/templates/gst-self-declaration.pdf`
- edit: `supabase/functions/ocr-extract/index.ts`
- edit: `supabase/functions/validate-gst/index.ts`
- edit: `supabase/functions/validation-orchestrator/index.ts`
- edit: `src/types/vendor.ts`
- edit: `src/components/vendor/steps/ComplianceStep.tsx` (or current GST/MSME step)
- edit: `src/components/vendor/steps/ReviewStep.tsx`
- edit: `src/hooks/useVendorRegistration.tsx`
- edit: `src/pages/FinanceReview.tsx`
- edit: `src/components/admin/ValidationConfigManager.tsx`

### Expected result

- Non-GST vendors complete onboarding via signed self-declaration; no fake GSTIN
- Non-MSME vendors answer "No" and move on; no MSME number required
- GST-registered vendors get richer auto-captured data (Legal/Trade name, Constitution, Address, Status, Jurisdictions, etc.) from one certificate upload
- Reviewers see complete GST profile in Finance Review
- Orchestrator no longer fails skip-by-choice cases

### Technical notes

- Self-declaration template is a static PDF; per-vendor pre-fill is a follow-up
- Existing `validation_configs` rows unchanged — they only fire when vendor declares Yes
- Skipped validations recorded in `vendor_validations` with `status='skipped'` for audit
- OCR confidence per extended field still respected; low-confidence fields are flagged for manual review

