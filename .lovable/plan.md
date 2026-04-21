

## Document-First Vendor Registration (OCR + Verify Gate)

### New Concept

Restructure the vendor registration so **document upload + OCR + real-time API verification happens UPFRONT as Step 1**. The vendor cannot enter any other details until PAN, GST, MSME, and Bank (cancelled cheque) are uploaded, OCR-extracted, and API-verified.

All subsequent steps (Organization, Address, Contact, Commercial, Bank, Review) are **pre-filled** from the verified data and largely become read-only confirmation screens.

### New Step Flow

```text
Step 1: Document Verification (NEW — gate)
   ├─ Upload PAN card        → OCR → validate-pan        → ✅ locks pan, holder_name
   ├─ Upload GST certificate → OCR → validate-gst        → ✅ locks gstin, legal_name, address
   ├─ Upload MSME / Udyam    → OCR → validate-msme       → ✅ locks udyam_number, enterprise_name
   └─ Upload Cancelled Cheque→ OCR → validate-penny-drop → ✅ locks account_number, ifsc, bank
        ⬇ (only when all 4 are green)
Step 2: Organization     ← pre-filled from GST/PAN, mostly read-only
Step 3: Address          ← pre-filled from GST certificate
Step 4: Contact          ← vendor enters manually
Step 5: Commercial       ← pre-filled, vendor adds turnover/credit terms
Step 6: Bank             ← pre-filled from cheque, read-only
Step 7: Review & Submit
```

A field auto-filled from a verified document gets a small **"AI-verified"** badge and is **locked** (cannot be edited). If the vendor needs to change it, they must re-upload a new document.

### What Gets Built

**1. New edge function `supabase/functions/ocr-extract/index.ts`**
- Input: `{ fileBase64, mimeType, documentType: 'pan'|'gst'|'msme'|'cheque' }`
- Calls Lovable AI Gateway (`google/gemini-2.5-flash`, vision + tool-calling) with a per-document JSON schema
- Extracts the relevant fields per document (PAN→number+name+DOB; GST→GSTIN+legal_name+trade_name+address; MSME→Udyam number+enterprise; Cheque→account+IFSC+bank+holder)
- Returns `{ success, extracted, confidence, raw_text }`
- Logs every extraction to a new `ocr_extractions` table

**2. New table `ocr_extractions`** (migration)
- `id, vendor_id, document_type, extracted_data jsonb, confidence numeric, created_at`
- RLS: vendor reads own; admins read all in tenant

**3. New step component `src/components/vendor/steps/DocumentVerificationStep.tsx`**
- 4 upload tiles in a 2×2 grid (PAN, GST, MSME, Cancelled Cheque)
- Each tile shows: drop zone → "Reading document…" → extracted preview chip → "Verifying with API…" → green check / red retry
- Internal state machine per doc: `idle → uploading → ocr_running → ocr_done → api_verifying → verified | failed`
- Cross-validation: after each verification, calls existing `validate-name-match` to compare OCR holder name vs API registered name; surfaces a name-match score
- Big sticky banner at top: "X of 4 documents verified. Complete all to continue."
- Continue button disabled until all 4 are `verified`

**4. New hook `src/hooks/useOcrExtraction.tsx`**
- `extractFromFile(file, documentType)` → invokes `ocr-extract` edge function
- Handles base64 conversion of the uploaded file before sending

**5. Update `src/components/vendor/FileUpload.tsx`**
- Add `enableOcr?: boolean` and `onOcrExtracted?: (data) => void` props
- After upload, optionally trigger OCR and emit extracted JSON

**6. Restructure `src/pages/VendorRegistration.tsx`**
- Insert new "Document Verification" as Step 1; renumber existing steps to 2–7
- Pass extracted+verified data into a new `verifiedData` slice of vendor state
- Pre-fill subsequent steps from `verifiedData` and mark those fields locked (read-only with the AI-verified badge)
- Override the existing step navigation guard to block advancement until Step 1 reports all 4 verifications green

**7. Update existing steps for locked/pre-filled fields**
- `OrganizationStep` / `EnterpriseOrganizationStep`: PAN, GSTIN, legal name → locked
- `AddressStep`: registered address → pre-filled, locked (vendor can still edit communication address)
- `BankStep`: account number, IFSC, bank name → locked; only MICR/branch address remain editable
- `CommercialStep`: MSME number/category → locked; turnover & credit terms remain editable
- A new shared `<LockedField>` wrapper renders the lock icon, "AI-verified" badge, and a "Re-upload document to change" tooltip

**8. New component `src/components/vendor/OcrComparisonCard.tsx`** (used inside Step 1 tiles)
- Side-by-side: value read from document (OCR) vs value returned by verification API
- Green check on match; amber warning + name-match score on mismatch

### UX Notes

- OCR runs **automatically on upload** — no extra "Extract" button
- Verification API also runs **automatically** as soon as OCR returns a parsable number — vendor just watches the tile turn green
- If OCR confidence < 0.6 or a field can't be parsed: tile turns amber with "Couldn't read clearly — please re-upload a sharper scan"
- If the verification API rejects the number: tile turns red with the API error and a "Retry / Upload different document" action
- A vendor who already has a draft skips Step 1 if previous verifications are still valid (cached in `vendor_validations`)

### Files Touched

- **New**: `supabase/functions/ocr-extract/index.ts`
- **New migration**: `ocr_extractions` table + RLS
- **New**: `src/hooks/useOcrExtraction.tsx`
- **New**: `src/components/vendor/steps/DocumentVerificationStep.tsx`
- **New**: `src/components/vendor/OcrComparisonCard.tsx`
- **New**: `src/components/vendor/LockedField.tsx`
- **Edit**: `src/components/vendor/FileUpload.tsx` (OCR trigger)
- **Edit**: `src/pages/VendorRegistration.tsx` (insert Step 1, renumber, gate, pre-fill)
- **Edit**: `src/components/vendor/StepIndicator.tsx` / `EnterpriseStepIndicator.tsx` (8 steps now)
- **Edit**: `OrganizationStep.tsx`, `AddressStep.tsx`, `BankStep.tsx`, `CommercialStep.tsx` (locked fields, pre-fill)

### Out of Scope

- No changes to `validate-pan`, `validate-gst`, `validate-msme`, `validate-penny-drop` — they already return the registered name we cross-match against
- No DB schema change to `vendors` — extracted values flow into the existing columns
- Memory rule "Verification gating" already exists; this plan extends it to the document-level gate at Step 1

### Cost / Performance

- Lovable AI Gateway (`google/gemini-2.5-flash`) — pre-configured `LOVABLE_API_KEY`, no extra setup
- ~2–4s per document for OCR; verification APIs add ~1–3s; total Step 1 ≈ 30–60s for an attentive vendor

