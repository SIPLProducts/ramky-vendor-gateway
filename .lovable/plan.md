## Goal

Restructure the **Compliance / KYC** section of vendor registration into **4 tabs** — one per identity to verify — with the right capture mode per tab:

| Tab    | Manual entry + Verify | OCR upload + Verify |
|--------|:--:|:--:|
| GST    | Yes | Yes |
| PAN    | No  | Yes (OCR only) |
| MSME   | Yes | Yes |
| Bank   | No  | Yes (OCR only) |

Inside GST and MSME tabs there is a secondary toggle (sub-tabs) to pick **Enter manually** or **Upload document**. PAN and Bank tabs show only the upload flow.

In every flow, the value that ultimately gets saved is the one **verified against the configured KYC validation API** (Surepass / configured provider through `kyc-api-execute`). For OCR flows, the extracted value is auto-fed into the validation API and a side-by-side comparison is shown.

## Tab structure (new layout)

```text
┌─ KYC & Statutory Verification ────────────────────────────────────┐
│ [ GST ●verified ] [ PAN ○ ] [ MSME ○ ] [ Bank ○ ]                  │
├───────────────────────────────────────────────────────────────────┤
│  (tab content: manual/upload sub-tabs OR upload-only)             │
└───────────────────────────────────────────────────────────────────┘
```

Each tab header shows a small status pill (Pending / Verified / Failed / Not applicable) so the vendor sees overall progress at a glance. A footer summary line shows "X of 4 verified" and gates the Next button (respecting existing rules: GST is skippable if "not registered", MSME skippable if "not registered", PAN + Bank are mandatory).

### Tab 1 — GST
- Yes/No question stays at the top: "Are you GST registered?"
- If **No** → existing self-declaration flow (download template, upload signed copy, reason).
- If **Yes** → sub-tabs:
  - **Enter manually**: GSTIN input + Verify (current `validate-gst`).
  - **Upload certificate**: `FileUpload` for GST certificate → OCR (`documentType=gst`) → auto-call `validate-gst` with extracted GSTIN → `OcrComparisonCard` (GSTIN, legal_name, trade_name, status, address). On pass, GSTIN field is locked, certificate file attached, extended GST fields auto-populated.

### Tab 2 — PAN (upload only)
- `FileUpload` for PAN card → OCR (`documentType=pan`) → auto-call `verify-pan` with extracted PAN → `OcrComparisonCard` (pan_number, holder_name vs API full_name, name match score). On pass, PAN value is set on the form (read-only "Verified PAN: ABCDE1234F" chip) and PAN file attached.

### Tab 3 — MSME
- Yes/No question: "Are you MSME registered?"
- If **No** → tab marked "Not applicable".
- If **Yes** → sub-tabs:
  - **Enter manually**: Udyam number + Verify (`validate-msme`).
  - **Upload certificate**: OCR (`documentType=msme`) → auto-call `validate-msme` → comparison card (udyam_number, enterprise_name, type). On pass, MSME number + category auto-fill, file attached.

### Tab 4 — Bank (upload only)
- `FileUpload` for cancelled cheque → OCR (`documentType=cheque`) → auto-call `validate-bank` with extracted account_number + ifsc_code → `OcrComparisonCard` (account_number, ifsc_code, bank_name, branch_name, account_holder_name vs API name_at_bank). On pass, bank account number, IFSC, bank name, branch, etc. are set on the form (read-only chips) and cheque file attached.
- Banner: "Bank details are captured from your cancelled cheque and verified with your bank. Manual entry is disabled."

## Shared UX rules

- **Only one in_progress at a time** per tab; while OCR/validation runs the tab badge shows a spinner.
- **Mismatch handling**: file stays uploaded, comparison card shows red ✕ on mismatched rows, "Re-upload" + (for GST/MSME) "Switch to manual entry" buttons.
- **Lock after success**: locked padlock icon + green border, "View details" toggle re-opens the comparison card.
- **Auto-advance**: completing a tab auto-focuses the next pending tab (no auto-skip if user is mid-edit).
- **Resume**: if vendor returns later, tabs hydrate from saved `vendor_validations` rows + uploaded file metadata so verified state persists.

## Files

**New**
- `src/components/vendor/kyc/KycTabs.tsx` — owns the 4-tab shell, status badges, "X of 4 verified" footer, gating logic.
- `src/components/vendor/kyc/GstKycTab.tsx`
- `src/components/vendor/kyc/PanKycTab.tsx`
- `src/components/vendor/kyc/MsmeKycTab.tsx`
- `src/components/vendor/kyc/BankKycTab.tsx`
- `src/components/vendor/kyc/OcrUploadAndVerify.tsx` — shared block: FileUpload → OCR → auto-validate → OcrComparisonCard → locked summary. Takes `documentType`, `validateFn`, field-mapping callback.
- `src/components/vendor/kyc/ManualEntryAndVerify.tsx` — shared block: input + Verify button + ValidationMessage; calls the right `useFieldValidation` method.

**Edited**
- `src/components/vendor/steps/ComplianceStep.tsx`
  - Replace existing GST + PAN + MSME blocks with `<KycTabs ...>` rendering the 4 sub-tabs (PAN moves out of "Registration Details" into its own tab, GST/MSME sections are removed in their current form). The Yes/No questions live inside their respective tabs.
  - Keep the non-KYC fields (Firm Reg No., Entity Type, IEC No., memberships, enlistments, certifications, operational network) outside the KYC tabs in a separate section above.
- `src/components/vendor/steps/EnterpriseOrganizationStep.tsx`
  - Replace manual bank account / confirm / IFSC inputs with the new `<BankKycTab>` (or extract a shared `<BankCaptureBlock>` if reusing the same component is cleaner). Verified bank values populate the existing form fields read-only.
- `src/hooks/useFieldValidation.tsx` — no API changes; reused for all four validate calls.

## Backend reuse (no new endpoints)

- OCR continues to use `supabase/functions/ocr-extract` (Lovable AI gateway, Gemini 2.5 Flash, schemas already present for pan/gst/msme/cheque).
- Validation continues via existing `validate-gst`, `verify-pan` / `validate-pan`, `validate-msme`, `validate-bank`, which already route through `kyc-api-execute` + `api_providers` config (set up in the previous KYC API Settings work).
- Comparison and tab-state logic is fully client-side.

## Visual / Fiori styling

- Top-level tabs use existing `tabs.tsx` with the Fiori grey-on-white look; status pill uses existing `Badge` (`success`/`warning`/`secondary`).
- Sub-tabs (manual / upload) inside GST and MSME use the same `tabs.tsx` but with a lighter, segmented-control variant.
- Locked verified state mirrors `VerificationField` styling (lock icon, green border, success message).
- Comparison rows use the existing `OcrComparisonCard`.

## Out of scope

- Changes to KYC API admin settings (already shipped).
- Adding new providers / replacing the OCR engine.
- Approval workflow / notifications.
