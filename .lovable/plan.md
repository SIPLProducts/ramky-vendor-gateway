
# International Vendor Registration Flow

## Goal

Add a "Vendor Type" selector (Domestic / International) at the top of the Vendor Registration form. Domestic keeps the current 6-step flow. International switches to a shorter flow with 3 new tabs, a trimmed Organization Profile (Classification only), and the existing Review & Submit page.

## UX

### Vendor Type selector
Two large radio cards rendered above the step indicator on every step:
- **Domestic Vendor** (default)
- **International Vendor**

Selected card: green border (`border-emerald-500`), light green background tint, check icon, subtle shadow. Unselected: neutral border. Mobile-friendly, full width on small screens, side-by-side on `md+`.

Switching type after entering data shows a confirm dialog: "Switching will clear data entered in the other flow. Continue?". On confirm, the abandoned side's form data is reset to its initial state (Domestic → reset international slice; International → reset domestic slices: organization (except Classification), address, contact, statutory, bank, financial, infrastructure, qhse, verifiedData, custom steps).

### International step list
Replaces the 6 built-in steps when International is selected:

1. **Documents Upload** — Registration Copy, SWIFT/IBAN Details (PDF/JPEG/PNG; reuse `FileUpload` component used for GST/PAN)
2. **Company Details** — fields listed below
3. **Company Bank Details** — fields listed below
4. **Organization Profile (Classification only)** — Material Group for Vendors, Vendor Category, Vendor Location, Vendor Identification Source (all manual entry, multi-select like today)
5. **Review & Submit** — existing `ReviewStep`, rendered with an international-aware summary section

Custom admin-defined dynamic steps are skipped for International.

### Field specs

**Company Details**
- Company Name * (text)
- Company Address * (textarea)
- Pincode * (text, manual entry, no lookup)
- Country * (select, fetched from SAP country master via existing `useRefreshSapMaster` / `sap-master-fetch` edge function)
- Region * (select, filtered by selected Country from SAP region master; disabled until country chosen)
- Company Contact 1 * (tel, digits only)
- Company Contact 2 (tel, digits only)
- Company Email 1 * (email format)
- Company Email 2 (email format, optional)

**Company Bank Details** (all optional, "Continue" always enabled)
- Account Number, SWIFT Code, Company Name, Bank Name, Bank Branch, IBAN Number (alphanumeric)

Validation: only the required Company Details fields gate "Continue". Documents Upload requires both files. Bank Details is fully optional. Classification step requires all 4 fields (matches existing behavior).

## Technical Plan

### Types (`src/types/vendor.ts`)
Add:
```
export type VendorOriginType = 'domestic' | 'international';

export interface InternationalCompanyDetails { companyName, companyAddress, pincode, country, region, contact1, contact2, email1, email2 }
export interface InternationalBankDetails { accountNumber, swiftCode, companyName, bankName, bankBranch, ibanNumber }
export interface InternationalDocuments { registrationCopyFile: File|null, swiftIbanFile: File|null }

export interface VendorFormData {
  ...existing,
  vendorType: VendorOriginType,
  international?: {
    documents: InternationalDocuments,
    company: InternationalCompanyDetails,
    bank: InternationalBankDetails,
  },
}
```

### New components (`src/components/vendor/steps/international/`)
- `VendorTypeSelector.tsx` — the radio card UI
- `IntlDocumentsStep.tsx` — two `FileUpload` blocks
- `IntlCompanyDetailsStep.tsx` — form with SAP-driven Country/Region using `SapF4SelectField` pattern already exported from `SapFieldsDialog`
- `IntlBankDetailsStep.tsx` — plain inputs
- `IntlClassificationStep.tsx` — reuses the Classification card from `OrganizationStep` (extract into a small shared subcomponent)

### Routing in `VendorRegistration.tsx`
- Add `vendorType` state (persisted in `formData.vendorType`, default `'domestic'`)
- Build `registrationSteps` conditionally: domestic = today's `builtInSteps` + custom + Review; international = the 4 intl steps + Review
- Render selector above `HorizontalStepIndicator`
- Switch handler: confirm dialog → call `resetDomestic()` or `resetInternational()` helpers → set step back to 1
- `canProceedFromCurrentStep` extended for international steps (docs both uploaded, company required fields valid, bank always true, classification 4 required)

### Database
Single migration: add to `vendors` table
- `vendor_type text default 'domestic'` (check 'domestic'/'international')
- `international_data jsonb` — stores company + bank fields and pincode/country/region (avoids 15+ new columns)

Two new document types in the existing `vendor_documents` table:
- `registration_copy`
- `swift_iban_details`

(`DocumentType` union and `uploadAllDocuments` in `useVendorRegistration.tsx` extended; storage path convention unchanged.)

### Save / submit (`useVendorRegistration.tsx`)
- `formDataToVendorRecord` writes `vendor_type` and `international_data` when type is international; nulls out domestic-only required columns on the international branch (legal_name, registered_address, primary_contact_*, bank_name, ifsc_code, etc.) by treating International's Company Name as `legal_name`, Country as `registered_state`/`branch_country`, Pincode as `registered_pincode`, Company Email 1 as `primary_email`, Contact 1 as `primary_phone`, etc., so existing NOT NULL constraints on `vendors` (if any) are satisfied without schema changes. Full original values are preserved in `international_data`.
- `uploadAllDocuments` extended with the two new types pulled from `formData.international.documents`
- Reset helpers exposed so the selector can clear cleanly

### Review step
`ReviewStep` gets a small conditional: when `vendorType === 'international'`, render an "International Vendor" summary card (company, country/region, contacts, bank, classification, uploaded docs) instead of the domestic sections.

### Out of scope
- Approval workflow changes, SAP sync payload changes (the existing sync just reads `vendors` columns + `international_data`; mapping can be tuned later)
- Email/notification template changes
- Form Builder admin UI changes
- Country/Region master seeding — assumes SAP country & region masters are already loadable via `sap-master-fetch` (same endpoint used in `MultipleSapSyncDialog`); if region master isn't available, falls back to a free-text input with a TODO

## Open assumptions (calling out, not blocking)
1. Country/Region come from the existing SAP master (same source as the F4 dropdowns in `MultipleSapSyncDialog`). If you have a different list in mind, point me to it.
2. International vendors still go through the same approval chain as domestic — no workflow split.
3. Storing extended international fields in a JSONB column on `vendors` is acceptable (keeps the schema small; queryable via `->>`).
