# Implementation Plan

## 1. Reset/refresh logic for GST, MSME, Bank (and PAN) in `DocumentVerificationStep.tsx`

**Goal:** When the user changes a Yes/No selection or re-uploads a document, fully clear previously fetched fields, OCR data, file references, and any payload remnants — only the latest upload + latest validated response should persist.

### GST tab
- When `setIsGstRegistered` is invoked and the new value differs from the previous one:
  - If switching **Yes → No**: reset `gstDoc` to empty (`{ status:'pending', file:null, ocrData:null, apiData:null, nameMatchScore:undefined, error:null }`), clear `editablePrincipalPlace`, clear any GST-derived banners/errors, and leave the Self-Declaration upload untouched (becomes active).
  - If switching **No → Yes**: clear `gstDeclarationFile` and any GST self-declaration state, reset `gstDoc` so the upload + verify flow starts fresh.
- On a fresh GST cheque/certificate upload (cheque case is bank, but for GST: if user re-uploads), reset prior `gstDoc` ocrData/apiData/error before kicking off `runDocFlow`.

### MSME tab
- When `setIsMsmeRegistered` flips:
  - **Yes → No**: reset `msmeDoc` (clear Udyam fields, OCR, apiData, file, status). Keep no self-declaration UI (already removed previously); ensure built payload omits MSME fields.
  - **No → Yes**: clear `msmeDeclarationFile` and reset `msmeDoc` so verification restarts cleanly.

### Bank tab (primary + secondary)
- Before starting OCR/penny-drop on a new cheque upload, reset the corresponding `bankDoc` / `bankDoc2` (file, OCR, apiData, IFSC enrichment fields, error, status) so old fetched bank/branch/IFSC values do not leak into the new attempt.
- On verification failure (OCR fail, low confidence, provider 4xx/5xx, name mismatch, rate-limit), clear the failed file reference and fetched fields from state so the next upload (or manual popup submit) starts from a clean slate. Keep the manual-entry popup behavior already wired in.

### PAN tab
- On re-upload, mirror the bank pattern: reset `panDoc` (file, OCR, apiData, error, status) before running the new flow so prior fetched values don't persist.

### Payload composition (existing `useEffect` building `VerifiedDocumentData`)
- Already gated on `status === 'verified'`, but explicitly drop fields when:
  - `isGstRegistered === false` → no `gst` block, only `gstSelfDeclarationFile`.
  - `isGstRegistered === true` → no `gstSelfDeclarationFile`.
  - `isMsmeRegistered === false` → no `msme` block and no MSME self-declaration.
  - Bank slots reset → omit corresponding `bank` / `bank2` blocks until re-verified.

**File:** `src/components/vendor/steps/DocumentVerificationStep.tsx` only. No backend changes.

---

## 2. Preview screen on Approval and SAP Sync screens

The vendor-side pre-submission preview (the rich, all-fields review used in `ReviewStep`) should also be available to approvers and the SAP Sync operator, alongside the existing **View** button (which opens `VendorReviewDialog`).

### Changes
- Add a new reusable `VendorSubmissionPreviewDialog` that renders the same layout as `ReviewStep` but in read-only mode, sourced from a vendor record (load vendor + related rows by `vendorId`, map to the `data` shape `ReviewStep` expects).
- In `src/components/approvals/StageApprovalView.tsx`: add a **Preview** button next to **View** in each row's actions. Opens the new dialog.
- In `src/pages/SAPSync.tsx`: add a **Preview** button next to the existing **View** action. Opens the same dialog.

**Files:**
- new: `src/components/vendor/VendorSubmissionPreviewDialog.tsx`
- edit: `src/components/approvals/StageApprovalView.tsx`
- edit: `src/pages/SAPSync.tsx`

No DB or edge function changes.

---

## 3. "No Reply" email configuration + buyer notification

### 3a. New tab in Email Configuration screen
In `src/pages/EmailConfiguration.tsx`, wrap the existing SMTP UI in a `Tabs` with two tabs:
1. **User SMTP Configuration** (existing screen unchanged).
2. **No Reply Email Configuration** (new): a single global SMTP record used as the system sender for vendor-related notifications. Form fields: From Email (e.g. `noreply@…`), From Name, SMTP Host, Port, Encryption, Username, App Password, Reply-To (optional). Includes Save + Send Test Email actions.

### 3b. Storage
Store the No-Reply config in the existing `portal_config` table (key/value rows: `noreply_smtp_host`, `noreply_smtp_port`, `noreply_smtp_encryption`, `noreply_smtp_username`, `noreply_smtp_password`, `noreply_from_email`, `noreply_from_name`, `noreply_reply_to`, `noreply_enabled`). RLS: only `sharvi_admin` / `admin` may read/write; no migration to schema, only inserts via the save handler. (If `portal_config` lacks admin-only policies, add a small migration to gate these keys.)

### 3c. Wire into buyer-notification edge function
Update `supabase/functions/notify-vendor-submission/index.ts`:
- Build the email exactly as today, but pass an inline `smtp` override block to `send-smtp-email` loaded from the `noreply_*` keys (falling back to the existing `smtp_*` keys if no-reply is not configured, to avoid breaking current installs).
- Update subject to: `Vendor Submitted Registration Form – <Vendor Name>`.
- Update body to include: Vendor Name, Vendor Email ID, Submitted Date & Time, Vendor ID, and the success message "Vendor <Vendor Name> has submitted the registration form successfully on <Date & Time>. Vendor ID: <Vendor ID>".
- `To:` remains the inviter (buyer) email derived from `vendor_invitations.created_by` profile (already implemented).

### 3d. Trigger
Already invoked from the vendor submit flow; no client change required beyond confirming it fires on submission.

**Files:**
- edit: `src/pages/EmailConfiguration.tsx` (add Tabs + No-Reply form, save handler that upserts `portal_config` rows).
- edit: `supabase/functions/notify-vendor-submission/index.ts` (load no-reply config, pass `smtp` override, update subject/body).
- optional migration: tighten RLS on `portal_config` for `noreply_*` keys if not already admin-only.

---

## Out of scope
- No changes to GST/PAN/MSME/Bank verification API logic itself.
- No change to existing per-user SMTP behavior for other emails.
- No change to vendor-facing ReviewStep UI.
