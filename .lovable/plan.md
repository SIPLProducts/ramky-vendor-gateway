## Add Optional Second Bank + Documents Tab in Approval View

Three coordinated changes: (1) optional second bank in registration with same OCR + penny-drop verification, (2) ensure all bank fields + uploaded cheque persist to DB, (3) add a Documents tab inside a "View" popup on stage approval screens.

---

### 1. Database migration

Add to `public.vendors` (all nullable):
- `bank_name_2`, `branch_name_2`, `account_number_2`, `ifsc_code_2`
- `account_holder_name_2`, `account_type_2`, `bank_address_2`, `micr_2`

Allow `'cancelled_cheque_2'` as a `vendor_documents.document_type` value (no schema change — it's free-text; just used as a new constant).

### 2. Vendor Registration — Bank tab (`DocumentVerificationStep.tsx`)

- Keep the existing cheque uploader as **Primary Bank Account** (mandatory, unchanged).
- Below it add a button **"+ Add Another Bank Account"** that reveals a second uploader section (`bankDoc2` state, `bankAccountType2`, `bankBranchAddress2`).
- The second uploader reuses `runDocFlow('cheque', file, setBankDoc2, …)` so OCR auto-fill, penny-drop, IFSC enrichment, and GST/PAN name match run identically.
- A "Remove" button next to the second section clears `bankDoc2` and reverts it to optional/hidden.
- `allDone` requires primary verified; if secondary is added it must also be verified before submission. Primary alone is sufficient when secondary is not added.
- Tab status pill shows combined progress.

### 3. Persistence (`useVendorRegistration.tsx` + types)

- Extend `BankDetails` in `src/types/vendor.ts` with optional `secondary` block (same fields as primary + `enabled` flag).
- On save: when secondary present, write `bank_name_2`, `account_number_2`, `ifsc_code_2`, `account_holder_name_2`, `branch_name_2`, `account_type_2`, `bank_address_2`, `micr_2` to `vendors`.
- Upload the secondary cheque file with `document_type: 'cancelled_cheque_2'` to bucket `vendor-documents`, recorded in `vendor_documents`.
- On load, hydrate `formData.bank.secondary` from the new columns + matching document.
- Audit confirmed: all other registration form fields (org, address, contact, statutory, financial, infra, QHSE) already persist via existing column mappings — no additional change needed beyond the new bank columns.

### 4. Approval screens — add View popup with Documents tab

Currently `StageApprovalView.tsx` (used by SCM Manager / SCM Head / Finance 1 / Finance 2 / CEO Office screens) has Approve / Reject buttons but no "View".

- Add a **View** button per row that opens a wide dialog (`max-w-5xl`) with tabs:
  - **Overview** — vendor name, PAN, GSTIN, status, submitted-at.
  - **Bank Details** — primary + secondary bank rows when present.
  - **Documents** — reuses `<VendorDocuments vendorId={…} />` (already supports listing, preview via signed URL, and download).
- `VendorDocuments.tsx`: extend `documentTypeLabels` with `cancelled_cheque_2: 'Cancelled Cheque (Secondary)'`, `gst_self_declaration`, `iec_certificate`, `swift_iban_proof`, `dealership_certificate` so all uploaded types render with friendly labels.
- Approver verification action (mark-as-verified) is out of scope of this round; download + view fulfills the verification need. (Can be added later as a per-document checkbox if you need an explicit audit trail.)

### Out of scope

- Mapping secondary bank into SAP sync payload (existing sync untouched; can be wired once SAP field IDs confirmed).
- More than 2 bank accounts.
- Per-document approver "verified ✓" status.

### Files touched

- New migration: `supabase/migrations/<ts>_add_secondary_bank_columns.sql`
- `src/types/vendor.ts`
- `src/components/vendor/steps/DocumentVerificationStep.tsx`
- `src/hooks/useVendorRegistration.tsx`
- `src/components/vendor/steps/ReviewStep.tsx` (show secondary bank in summary)
- `src/components/vendor/VendorDocuments.tsx` (extra labels)
- `src/components/approvals/StageApprovalView.tsx` (View button + tabs dialog)
