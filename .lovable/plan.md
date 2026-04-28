## Add IEC + SWIFT/IBAN fields with file uploads in Statutory & Registrations

In the **Organization Profile → Statutory & Registrations** section, the IEC No. field needs a document upload, and a new **SWIFT / IBAN Code** field (also with upload) must be added beside it.

### UI changes (`src/components/vendor/steps/OrganizationStep.tsx`)

Replace the current single-row layout for `IEC No.` + `Operational Network` with a new layout:

```text
Row 1:  [ IEC No. (Import/Export) ]   [ SWIFT / IBAN Code ]
Row 2:  [ IEC Certificate Upload  ]   [ SWIFT/IBAN Proof Upload ]
Row 3:  [ Operational Network (full width or paired) ]
```

- Add a new text field **SWIFT / IBAN Code** (optional, placeholder: `e.g. SBININBB123 or GB29NWBK60161331926819`).
- Add two `<FileUpload>` components below the inputs:
  - **IEC Certificate** — `documentType="iec_certificate"`, accepts `.pdf,.jpg,.jpeg,.png`, max 5MB.
  - **SWIFT / IBAN Proof** — `documentType="swift_iban_proof"`, same accept/size.
- Both uploads use the existing `FileUpload` component, which already pushes files to the `vendor-documents` Supabase storage bucket using `vendorId`.
- Pass the current `vendorId` (already available in `VendorRegistration.tsx`) down to `OrganizationStep` as a new prop so `FileUpload` can persist files to storage.

### Schema / type changes (`src/types/vendor.ts`)

Extend `StatutoryDetails` with:
- `swiftIbanCode: string`
- `iecCertificateFile: File | null`
- `swiftIbanProofFile: File | null`

### Form state (`src/components/vendor/steps/OrganizationStep.tsx`)

- Add the three new fields to the zod schema (`swiftIbanCode` optional string; the file fields are tracked in local component state, not the zod form, mirroring how `gstCertificateFile` etc. are handled today).
- Hydrate from `statutoryData` in `defaultValues` and pass them through in `handleFormSubmit`'s `statutory` object.

### Registration page (`src/pages/VendorRegistration.tsx`)

- Add `swiftIbanCode: ''`, `iecCertificateFile: null`, `swiftIbanProofFile: null` to the initial `statutory` default state.
- Pass `vendorId` prop into `OrganizationStep`.

### Persistence (`src/hooks/useVendorRegistration.tsx`)

- Map two new columns when saving/loading drafts:
  - `swift_iban_code` ↔ `swiftIbanCode`
  - File paths are already implicitly handled via storage bucket naming (`{vendorId}/iec_certificate_*`, `{vendorId}/swift_iban_proof_*`); no extra DB column needed for the files themselves (matches existing pattern for cert files).

### Database migration

Add one column to the `vendors` table:
```sql
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS swift_iban_code text;
```
No new column for files — they live in the existing `vendor-documents` storage bucket and are listed via `VendorDocuments.tsx`.

### Review step (`src/components/vendor/steps/ReviewStep.tsx`)

- Show **SWIFT / IBAN Code** value in the Statutory summary block.
- Show indicators for **IEC Certificate** and **SWIFT/IBAN Proof** (uploaded / not uploaded), matching how other certificate uploads are summarized.

### Out of scope

- No validation API for SWIFT/IBAN format (kept as free-text like IEC).
- No OCR auto-extraction for these certificates.
- No changes to admin form-builder or approval workflows.