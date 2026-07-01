## 1. Remove the Penny Drop step (static-data)

The real bank verification during vendor registration (cheque OCR + live BANK provider call in `BankKycTab` / `DocumentVerificationStep`) is kept intact — that is the actual account verification, not the static-data "Penny Drop" step.

Removed:
- **Admin > Document Verification page** — delete the `Penny Drop` tab, its state (`pennyDropResult`, `pennyDropStage`, `showPennyDropDialog`), the `runPennyDropMutation`, the progress dialog, and the tab trigger in `src/pages/DocumentVerification.tsx`.
- **`src/components/vendor/PennyDropDemo.tsx`** — delete file and remove any imports/routes referencing it (e.g. `DemoShowcase.tsx`, `Landing.tsx`).
- **`supabase/functions/validate-penny-drop/`** — delete the edge function (and drop from `supabase/config.toml`).
- Cosmetic: replace the "Penny-drop" wording in the Bank stage subtitles/busy labels/`CrossCheckStrip` texts in `DocumentVerificationStep.tsx` and `BankKycTab.tsx` with neutral "Bank verification" wording. No functional change to bank verification.

Kept as-is:
- Provider entry `BANK` (Bank Verification) in KYC API Settings — still the live cheque + account-validation flow.
- `BANK_PENNY_DROP` entry in `ApiProviderConfig.tsx` catalog will be removed (no longer offered).

## 2. Add PAN Comprehensive Validation API

**KYC API Settings** (`src/pages/KycApiSettings.tsx`, `src/components/admin/ApiProviderConfig.tsx`):
- Add a new provider `PAN_COMPREHENSIVE` — display name "PAN Comprehensive Validation", category `VALIDATION`. Admin configures endpoint, auth header, request template, and response field mappings (`status`, `aadhaar_linked`) the same way as existing providers.

**Vendor Registration — PAN section** (`src/components/vendor/kyc/PanKycTab.tsx`):
- After PAN OCR succeeds and PAN-vs-GST match passes, if the `PAN_COMPREHENSIVE` provider is configured, call it via `useConfiguredKycApi` with the verified PAN number.
- Read `status` and `aadhaar_linked` from the response and:
  - persist to the vendor row (see schema below);
  - show two read-only rows in the PAN section:
    - **PAN Status** → `Valid` if `status === "valid"` (case-insensitive), else `Invalid`.
    - **Is Aadhaar Linked** → `Aadhaar Linked with PAN` if `aadhaar_linked === true`, else `Aadhaar Not Linked with PAN`.
- If the provider is not configured or the call fails, leave the two fields empty (do not block PAN verification).

**View screens** — display the same two labels wherever PAN Number / PAN Card / GST details are shown:
- `src/pages/VendorList.tsx` (vendor detail dialog / row expand)
- `src/components/vendor/VendorReviewDialog.tsx`
- `src/pages/VendorStatus.tsx`
- Approval screens: `src/pages/approvals/BuyerApproval.tsx`, `ScmManagerApproval.tsx`, `ScmHeadApproval.tsx`, `Finance1Approval.tsx`, `Finance2Approval.tsx`, `CeoApproval.tsx`, and `src/components/approvals/StageApprovalView.tsx`
- `src/pages/Reports.tsx` (add two report columns: `PAN Status`, `Is Aadhaar Linked with PAN`) and `src/lib/reports/loadVendorReport.ts` / `exportExcel.ts` / `exportPdf.ts`

## 3. Database

Migration on `public.vendors`:
- Add `pan_status text` (nullable) — raw API value.
- Add `pan_aadhaar_linked boolean` (nullable).
- Add `pan_comprehensive_verified_at timestamptz` (nullable) so the UI can show when the check ran.

No RLS/policy changes needed — columns inherit the existing `vendors` policies.

## Out of scope
- No changes to Bank verification logic, MSME, GST, or approval routing.
- No renaming of the existing `BANK` provider — only the standalone "Penny Drop" static-data pieces are removed.
- No changes to the "SCM CO → SCM Approval" sidebar label or the buyer-return-to-vendor gating that were already implemented.
