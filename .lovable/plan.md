## Vendor Registration UI cleanup

### 1) Step indicator descriptions
Remove sub-descriptions under each step (keep titles + numbers):
- Document Verification: remove "Upload & auto-verify PAN, GST, MSME, Bank"
- Organization Profile: remove description
- Address Information: remove description
- Contact Details: remove description
- Financial & Infrastructure: remove description

Edits in `src/pages/VendorRegistration.tsx` and `src/components/vendor/EnterpriseStepIndicator.tsx`.

### 2) GST tab (`GstKycTab.tsx`)
- Remove "GST Verification" heading + "Upload your GST certificate or declare non-registration" subtitle.
- Remove "Reason for Non-Registration" field.
- Rename "GST Self-Declaration" → "Non-GST Self-Declaration".
- Remove helper text: "Review the extracted details. Click any field to correct it if the document was misread." (if present here).
- In `GstFilingStatusTable.tsx`: hide Refresh button and "GSTR1 Filed for June 2026" label.

### 3) PAN tab (`PanKycTab.tsx`)
- Remove "PAN Verification — Upload PAN card to extract and verify holder details" section header.
- Remove helper text: "Review the extracted details. Click any field to correct it if the document was misread."

### 4) MSME tab (`MsmeKycTab.tsx`)
- Change radio label "No, skip" → "No".
- Remove "MSME / Udyam — Optional — upload Udyam certificate or skip" section header.
- Ensure question reads "Are you MSME registered?".
- Remove "Reason for non-registration" field.
- Remove "Review the extracted details…" helper text if present.

### 5) Bank tab (`BankKycTab.tsx`)
- Remove "Bank Account — Upload cancelled cheque and…" section header.
- Remove "Review the extracted details…" helper text if present.

### 6) 3-column layout for tab fields
For GST, PAN, MSME, and Bank tabs — arrange input fields in a 3-column responsive grid (`grid md:grid-cols-3 gap-4`) instead of the current 1 or 2-column layouts. Full-width sections (file uploads, alerts, API response cards) stay full-width via `md:col-span-3`.

### Technical notes
- Presentation-only edits (JSX/labels/grid classes). No schema, validation, or business logic changes.
- Verify build after edits.
