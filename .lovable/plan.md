
## Goal

In the International flow Company Details step, remove the **State** field entirely and reorganize the layout so **Country (From SAP)**, **Region (From SAP)**, **City**, and **PIN Code** all live inside the existing "Country, Region & Contacts" card together with the contact fields. The Address card keeps only Address Lines 1–4, Office Phone, and Fax.

## Changes

### 1. `IntlCompanyDetailsStep.tsx` (UI + schema)
- Remove the `state` field from the Zod schema.
- Remove the State input from the Address card. City and PIN Code inputs also move out of the Address card.
- New Address card layout:
  - Address Line 1 (full width)
  - Row: Address Line 2 / Line 3 / Line 4
  - Row: Office Phone / Fax
- New "Country, Region & Contacts" card layout:
  - Row: Country (From SAP) * / Region (From SAP) *
  - Row: City * / PIN Code *
  - Row: Contact 1 * / Contact 2
  - Row: Email 1 * / Email 2

### 2. `src/types/vendor.ts`
- Drop `state` from `InternationalCompanyDetails` and from `EMPTY_INTERNATIONAL_DATA`.

### 3. `src/hooks/useVendorRegistration.tsx`
- Stop mirroring `state` → `registered_state`. Instead mirror the SAP **Region** description (or code) → `registered_state` so reports/SAP still have a location value. Remove any writes referencing the removed field.

### 4. SAP payload (`sync-vendor-to-sap/index.ts` + `sapDefaultTemplate.ts`)
- `LOCATION` mapping continues to come from `registered_state` (now populated from Region). No new keys.
- Remove any leftover reference to the international `state` input.

### 5. Display surfaces
- `ReviewStep.tsx`, `VendorSubmissionPreviewDialog.tsx`, `VendorReviewDialog.tsx`: remove the "State" line from the International section. City / PIN / Country / Region stay.

### 6. Backward compatibility
- Existing vendors that saved `international_data.company.state` are simply ignored — no migration needed. Their `registered_state` value stays as-is.

## Out of scope
- No database schema changes.
- Domestic (Indian) flow is untouched.
- No changes to validation rules for City / PIN / Country / Region beyond their existing required checks.
