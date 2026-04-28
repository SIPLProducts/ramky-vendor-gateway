## Add Contact 2 and Email 2 to CEO / Managing Director block

In the Contact Details step, the CEO / Managing Director section currently has one Contact Number and one Email. Add a secondary phone and secondary email so the CEO/MD card has two of each, with Contact 1 and Email 1 remaining required and Contact 2 and Email 2 optional.

### UI changes — `src/components/vendor/steps/ContactStep.tsx`
- Rename the existing labels for clarity:
  - "Contact Number *" → "Contact Number 1 *" (still `ceoPhone`)
  - "Email Address *" → "Email Address 1 *" (still `ceoEmail`)
- Add a new row inside the CEO / Managing Director section with:
  - "Contact Number 2" (optional) → field `ceoPhone2`
  - "Email Address 2" (optional) → field `ceoEmail2`
- Extend the Zod schema:
  - `ceoPhone2: z.string().optional()`
  - `ceoEmail2: z.string().email('Valid email required').optional().or(z.literal(''))`
- Other contact blocks (Marketing, Production, Customer Service) stay unchanged.

### Type & state changes
- `src/types/vendor.ts` → `ContactDetails`: add `ceoPhone2?: string` and `ceoEmail2?: string`.
- `src/pages/VendorRegistration.tsx` → initial `contact` object: add `ceoPhone2: ''`, `ceoEmail2: ''`.
- `src/data/mockVendors.ts` → add empty defaults to keep mock data type-safe.
- `src/components/vendor/steps/ReviewStep.tsx` → render the two new values under the CEO/MD review block (only when present).

### Persistence
- Database migration on `public.vendors`: add `primary_phone_2 text` and `primary_email_2 text` (both nullable).
- `src/hooks/useVendorRegistration.tsx`:
  - Save: map `formData.contact.ceoPhone2` → `primary_phone_2`, `formData.contact.ceoEmail2` → `primary_email_2`.
  - Hydrate: map back into `contact.ceoPhone2` / `contact.ceoEmail2` when loading a draft.

### Validation rules
- Contact 1 required (min 10 chars), Email 1 required (valid email) — unchanged behaviour.
- Contact 2 and Email 2 optional; if Email 2 is filled, it must be a valid email.
