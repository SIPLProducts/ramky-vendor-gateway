## Goal

In the Vendor Registration Form → Address tab → Address Details (registered address) section, add four new fields:

- Contact 1 (mandatory)
- Contact 2 (optional)
- Email 1 (mandatory) — rename the existing "Email ID" field to "Email 1"
- Email 2 (optional)

## Changes

### 1. Database (`supabase/functions`/migrations)
Add four columns on `public.vendors`:
- `registered_contact_1 text`
- `registered_contact_2 text`
- `registered_email_2 text`

(Reuse existing `registered_email` as Email 1; no rename needed at the DB level.)

### 2. Types (`src/types/vendor.ts`)
Extend `AddressDetails` with:
- `registeredContact1: string`
- `registeredContact2: string`
- `registeredEmail2: string`

(`registeredEmail` continues to represent Email 1.)

### 3. Form UI (`src/components/vendor/steps/AddressStep.tsx`)
- Rename label "Email ID *" → "Email 1 *".
- Add inputs for Contact 1 *, Contact 2, Email 2 in the Address Details grid (10-digit phone style for contacts, email validation for Email 2).
- Zod schema:
  - `registeredContact1`: required 10-digit phone
  - `registeredContact2`: optional 10-digit phone
  - `registeredEmail` (Email 1): keep required + email
  - `registeredEmail2`: optional, valid email when provided

### 4. Form state defaults / load / persist (`src/hooks/useVendorRegistration.tsx`)
- Add the three new fields to the empty form initializer and to the `loadVendor` mapper.
- Include them in the autosave/submit payload mapping to the new DB columns.

### 5. SAP payload (`src/lib/sapPayloadBuilder.ts` + edge functions `sync-vendor-to-sap`, `sync-vendors-to-sap-bulk`)
- Expose the new fields as template variables (e.g. `vendor.registered_contact_1`, `vendor.registered_contact_2`, `vendor.registered_email_2`) so admins can map them in SAP payload templates.
- Keep existing `registered_phone` / `primary_email` mappings untouched to avoid breaking current SAP sync; new fields are additive.

### 6. Review / preview surfaces
Update `ReviewStep.tsx` and `VendorSubmissionPreviewDialog.tsx` (only the Address section) to display the four fields with the new labels.

## Out of scope
- No changes to manufacturing / branch contact blocks.
- No changes to ContactStep (CEO/Marketing/etc.).
- No changes to validation orchestrator or KYC flows.
