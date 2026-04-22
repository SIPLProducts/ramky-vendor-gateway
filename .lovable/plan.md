

## Remove both Commercial Details AND Bank Details steps (consolidate to 6 steps)

### Why
Step 1 (Document Verification) already does OCR + real-time API verification for **PAN, GST, MSME, and Bank (cancelled cheque + penny drop)**. Re-asking the vendor for the same data in later steps is pure duplication.

### What changes

**Registration flow goes from 8 steps to 6 steps:**

```text
Before:  1 Doc Verify → 2 Org → 3 Address → 4 Contact → 5 Commercial → 6 Bank → 7 Fin/Infra → 8 Review
After:   1 Doc Verify → 2 Org → 3 Address → 4 Contact → 5 Fin/Infra → 6 Review
```

- **Step 5 (Commercial Details) removed** — GST/PAN/MSME already captured in Step 1.
- **Step 6 (Bank Details) removed** — Bank Name, Branch, Account Number, IFSC, MICR, Account Holder Name and the cancelled cheque file are all captured in Step 1's Bank tile (OCR + penny-drop verification).
- **Fin/Infra becomes Step 5**, **Review becomes Step 6**.

### Fields that need to survive

**From Commercial Details (not on PAN/GST/MSME docs):**
Entity Type, Firm Reg No, PF Number, ESI Number, IEC No, Labour Permit, Memberships, Enlistments, Certifications, Operational Network → moved into **Step 2 Organization Profile** as a "Statutory & Memberships" sub-section.

**From Bank Details (not captured by cheque OCR):**
- Account Type (current / savings / cash credit / others) — not on a cheque
- Bank Address — usually not on a cheque
- Confirm Account Number — pure UI re-entry guard, no longer needed since the OCR'd value is shown for review/correction in Step 1

→ Account Type + Bank Address get added as two small fields inside Step 1's Bank verified panel (after penny-drop succeeds), so the vendor sets them once, in context, alongside the OCR'd bank values they can already edit. Account Type defaults to `current`. Bank Address is optional.

### Files to edit

1. **`src/pages/VendorRegistration.tsx`**
   - Drop `CommercialStep` and `BankDetailsStep` imports.
   - Update `registrationSteps` to the 6-step list (Doc Verify, Org, Address, Contact, Fin/Infra, Review).
   - In `renderStep()`: remove `case 5` (Commercial) and `case 6` (Bank); shift Fin/Infra → `case 5`, Review → `case 6`.
   - Update `handleStepComplete` `stepKeys` map (drop `statutory` and `bank` entries).
   - Update `handleFinancialInfraComplete` to advance to step 6 and mark step 5 complete.
   - Update `canProceedFromCurrentStep()` and `getValidationMessage()` — remove the Commercial and Bank branches.
   - Update the draft-resume "filled steps" detector: drop `entityType` and `bankName` mappings; fallback target becomes step 6.
   - Update `handleStartEdit` seed `completedSteps` to `[1,2,3,4,5]`.

2. **`src/components/vendor/steps/DocumentVerificationStep.tsx`**
   - In the Bank verified panel (rendered after penny-drop passes), add two `EditableOcrField`s: **Account Type** (Select: Current / Savings / Cash Credit / Others) and **Bank Address** (text). Default Account Type to `current`.
   - Extend `VerifiedDocumentData.bank` to include `accountType` and `bankAddress`.
   - Include both in `buildOutput()`.

3. **`src/pages/VendorRegistration.tsx` → `mergeVerifiedDataIntoForm`**
   - Map `verifiedData.bank.accountType` → `formData.bank.accountType` (default `current`).
   - Map `verifiedData.bank.bankAddress` → `formData.bank.bankAddress`.

4. **`src/components/vendor/steps/OrganizationStep.tsx`**
   - Add "Statutory & Memberships" sub-section: Entity Type, Firm Reg No, PF, ESI, IEC, Labour Permit, Memberships, Enlistments, Certifications, Operational Network. Reuse constants from `src/types/vendor.ts` and the existing `MultiSelect` component. These write into `formData.statutory` (no type changes needed).

5. **`src/components/vendor/steps/ReviewStep.tsx`**
   - Keep the read-only Commercial and Bank summary cards (vendors still see the verified values).
   - Update edit-button targets: statutory → Step 1 or Step 2, bank → Step 1.

6. **`src/hooks/useFormCompleteness.tsx`**
   - If it weights step 5 (Commercial) or step 6 (Bank) separately, fold those weights into Step 1 / Step 2 so 100% remains achievable.

7. **Delete files**
   - `src/components/vendor/steps/CommercialStep.tsx`
   - `src/components/vendor/steps/BankDetailsStep.tsx` (and `BankStep.tsx` if unreferenced after this change)

### Not changing
- OCR pipeline, real-time APIs (PAN, GST, MSME, penny drop), gating, autosave, draft save — unchanged.
- Database schema — `vendors` already has `bank_name`, `bank_branch_name`, `account_number`, `ifsc_code`, `micr_code`, `account_type`, `bank_address`, plus all statutory/membership columns.
- `formData.statutory` and `formData.bank` shapes — unchanged.
- Approval workflow, edge functions, SAP sync — unchanged.
- Existing drafts — values remain in `formData.statutory` / `formData.bank` and resurface in their new locations.

### Result
- Vendor enters PAN, GST, MSME and Bank details exactly **once**, in Step 1, via OCR + real-time verification, with inline manual correction.
- Form drops from 8 to 6 steps.
- Zero data loss; all non-OCR fields (entity type, memberships, account type, bank address, etc.) preserved in their most logical home.

