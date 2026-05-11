# MSME Self-Declaration when "No" is selected

Mirror the existing GST non-registration flow inside the MSME tab.

## What to build

When the user selects **No** for "Are you MSME registered?", show:
1. An info alert explaining the next step.
2. A **Download MSME Self-Declaration Template** button (opens an HTML template in a new tab; user prints/saves as PDF, signs, scans).
3. An optional **Reason for non-registration** textarea.
4. A **Signed MSME Self-Declaration** file upload (PDF/JPG/PNG).

When the user selects **Yes**, behavior is unchanged (existing manual entry / OCR upload tabs).

## Files to change

### 1. `public/templates/msme-self-declaration.html` (new)
A printable A4 declaration template, styled identically to `public/templates/gst-self-declaration.html`. Content adapted from the user-uploaded `Non-MSME_Declaration.docx`:
- Title: "Self-Declaration for Non-Registration under MSME"
- Subtitle: "(To be submitted on company letterhead, signed and stamped)"
- Addressed to "The Procurement Department, Sharvi Infotech Private Limited"
- Fields: Name of Entity, PAN, Constitution of Business, Registered Address, Reason for non-registration
- Declaration paragraphs covering: not registered under MSME Act; will inform the company if registered later; information furnished is true
- Signature block (Authorised Signatory + Company Seal & Date)
- Same Print/Save-as-PDF button and `@media print` styles

### 2. `src/components/vendor/kyc/MsmeKycTab.tsx`
- Add props: `msmeSelfDeclarationFile`, `onMsmeSelfDeclarationFileChange`, `msmeDeclarationReason`, `onMsmeDeclarationReasonChange`.
- Update `onStatusChange` so when `isMsmeRegistered === false`, status is `'passed'` if a signed declaration file is present, otherwise `'na'` (matches GST tab).
- Render the new "No" branch (Alert + Download button + Reason textarea + FileUpload) — using `documentType="msme_self_declaration"`.
- Keep existing "Yes" branch unchanged.

### 3. `src/components/vendor/steps/ComplianceStep.tsx`
- Add local state `msmeSelfDeclarationFile` and `msmeDeclarationReason` (read initial values from `data.statutory`).
- Pass new props to `<MsmeKycTab>`.
- Include both in the `onComplete`/save payload alongside `msmeCertificateFile`.

### 4. `src/pages/VendorRegistration.tsx`
- Extend the `statutory` initial state with `msmeSelfDeclarationFile: null` and `msmeDeclarationReason: ''`.
- Wire the new fields through `setVerifiedData` / step persistence the same way GST does.
- Update the `msmeOk` gate so a non-MSME vendor is also acceptable when a signed declaration file is uploaded (mirrors GST behavior — optional, see Open question).

### 5. `src/hooks/useVendorRegistration.tsx`
- Add `{ file: formData.statutory.msmeSelfDeclarationFile, type: 'msme_self_declaration' }` to the document upload list (next to `msme_certificate`).
- Persist `msme_declaration_reason` if a column exists; otherwise skip (see DB section).

### 6. `src/components/vendor/steps/ReviewStep.tsx`
- Under the MSME row, when `isMsmeRegistered === false`, show whether a signed declaration was uploaded and the reason (read-only summary), matching the GST review row pattern.

## Database

No schema change is required for the file itself — `msme_self_declaration` will be stored as a row in `vendor_documents` keyed by `document_type`, exactly like `gst_self_declaration` already is.

If we want to persist the optional reason, we can either:
- (a) reuse a notes/metadata column on `vendor_documents`, or
- (b) add a `msme_declaration_reason text` column to the vendors table (matches `gst_declaration_reason` if that exists today).

Recommendation: only add a column if the GST equivalent is already a column. Otherwise keep the reason in form state / document metadata.

## Out of scope

- No OCR/verification of the signed declaration (same as GST).
- No changes to MSME Yes-branch flow or to existing approval gating beyond letting "No + signed declaration" count as complete.

## Open question

Should uploading the signed MSME declaration be **mandatory** to proceed past the Compliance step (matches GST's strict gate), or remain **optional** like the current MSME-No path? Default in this plan: mandatory, matching GST.
