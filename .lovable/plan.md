## Add Address Line 4 + Email field across all address blocks

In the **Address Information** step, extend each address block (Registered, Manufacturing, Branch) with a new **Address Line 4** field, enforce a **40-character limit on all four address lines**, and add a **required Email ID** field beside the Website field.

### Type changes (`src/types/vendor.ts`)

Extend `AddressDetails` with:
- `registeredAddressLine4: string`
- `registeredEmail: string` (required)
- `manufacturingAddressLine4: string`
- `manufacturingEmail: string`
- `branchAddressLine2: string`, `branchAddressLine3: string`, `branchAddressLine4: string` (currently branch has only one address line)
- `branchEmail: string`

### Schema / form changes (`src/components/vendor/steps/AddressStep.tsx`)

- Update zod schema: each of the four address lines uses `z.string().max(40, 'Maximum 40 characters allowed')`. Line 1 stays required (`.min(5)`), Lines 2–4 stay optional but capped at 40.
- `registeredEmail` becomes required: `z.string().trim().email('Valid email required').max(100)`.
- `manufacturingEmail` and `branchEmail`: optional, validated as email when present.
- UI updates:
  - **Registered block** — add Address Line 4 input next to Line 3 (or in a new row), apply `maxLength={40}` on Lines 1–4, and add an **Email ID *** field in the same row as Website.
  - **Manufacturing block** — same Line 4 + Email additions, mirroring registered when "same as registered" is checked (extend the `useEffect` sync logic).
  - **Branch block** — split current single `branchAddress` into Lines 1–4 (each with `maxLength={40}`) and add Email field beside the existing Website field.
- Add `maxLength={40}` HTML attribute on all address line inputs as a UX safeguard alongside zod validation.

### Initial state (`src/pages/VendorRegistration.tsx`)

Add the new keys with empty-string defaults to the `address` object in `initialFormData` so the form has stable initial values and draft hydration works.

### Persistence (`src/hooks/useVendorRegistration.tsx`)

- Map the new fields when saving (`saveVendor`) and hydrating (`existingFormData`) drafts:
  - `registered_address_line4`, `registered_email`
  - `manufacturing_address_line4`, `manufacturing_email`
  - `branch_address_line2`, `branch_address_line3`, `branch_address_line4`, `branch_email`

### Database migration

Add the new columns to the `vendors` table:

```sql
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS registered_address_line4 text,
  ADD COLUMN IF NOT EXISTS registered_email text,
  ADD COLUMN IF NOT EXISTS manufacturing_address_line4 text,
  ADD COLUMN IF NOT EXISTS manufacturing_email text,
  ADD COLUMN IF NOT EXISTS branch_address_line2 text,
  ADD COLUMN IF NOT EXISTS branch_address_line3 text,
  ADD COLUMN IF NOT EXISTS branch_address_line4 text,
  ADD COLUMN IF NOT EXISTS branch_email text;
```

### Mock data (`src/data/mockVendors.ts`)

Add the new fields with empty/sample values so existing mock vendors remain type-valid.

### UX details

- Address Line 4 placeholder: `"Additional address detail (max 40 chars)"`.
- Email field placeholder: `"contact@company.com"`, `type="email"`, required indicator (*) only on the Registered Office block. Manufacturing and Branch emails stay optional.
- Validation errors render inline under each input in the existing destructive style.
- The "same as registered" toggle on Manufacturing also copies Line 4 and Email.

### Out of scope

- No changes to ReviewStep summary (existing block already iterates address lines generically — the new fields will surface there once persisted; only verify no hard-coded line-list).
- No OCR auto-population for the new fields.
- No SAP field mapping changes (can be added later by admin).