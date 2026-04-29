# Show & manage built-in fields in Form Builder

## Problem

Today, when an admin clicks a built-in tab in **Form Builder** (Document Verification, Organization Profile, Address Information, Contact Details, Financial & Infrastructure, Review & Submit), the Fields list is empty. That's because these tabs render hardcoded JSX inside step components (`OrganizationStep.tsx`, `AddressStep.tsx`, `ContactStep.tsx`, `DocumentVerificationStep.tsx`, `FinancialInfrastructureStep.tsx`) — they were never registered as `form_field_configs` rows.

The user wants every built-in tab to behave like a custom tab:
- See the full list of existing fields when the tab is opened.
- Toggle a field off (hide) or remove it from the vendor form entirely.
- Add new fields under the same tab.
- Keep all existing fields untouched if no changes are made.

## Solution overview

1. **Seed built-in fields per tenant** into `form_field_configs` so they appear in Form Builder exactly like custom fields.
2. **Make the vendor form respect overrides** so hide/remove/required toggles in Form Builder actually take effect on the registration UI.
3. Keep "Add Field" working as it already does — new admin fields render via existing `DynamicStep` logic appended below the built-in section of each tab.

## Step-by-step plan

### 1. Catalogue built-in fields (code-side reference)

Build a single source of truth `BUILT_IN_FIELDS_CATALOG` (in `src/lib/builtInFields.ts`) that lists every hardcoded field per built-in `step_key`, with: `field_name`, `display_label`, `field_type`, `is_mandatory`, `display_order`. Mined from existing step files:

- `document_verification`: GST registered toggle, GSTIN, PAN, MSME toggle, Udyam Number, Bank Account No, IFSC, Bank Name, Cancelled Cheque, GST/PAN/MSME documents.
- `organization`: Buyer Company, Legal Name, Trade Name, Industry Type, Organization Type, Ownership Type, Product Categories, State, Entity Type, Firm Reg No, PF Number, ESI Number, Labour Permit, IEC No, SWIFT/IBAN, Operational Network, Memberships, Enlistments, Certifications.
- `address`: Registered, Manufacturing, Branch address blocks (line1, line2, city, state, pincode, country).
- `contact`: Primary Contact Name, Designation, Email, Phone, Alternate Contact.
- `financial`: Annual Turnover, Net Worth, Facility Size, QHSE flags, etc.
- `review`: read-only — no editable fields.

### 2. Auto-seed on Form Builder load

In `src/pages/FormBuilder.tsx`, when fields for the active tenant load:
- For each built-in step key, check if there's at least one `form_field_configs` row for that tenant + `step_name`.
- If none exist, bulk-insert the catalog rows with a flag `default_value = '__builtin__'` (or add a new column later) so we can recognise them as auto-seeded.
- Use a one-time `useEffect` keyed by `(tenantId, hasBuiltins)` and a small mutation to insert.

After seeding, the existing Form Builder UI shows them automatically — drag-to-reorder, edit, hide and delete already work for any rows in `form_field_configs`.

### 3. Vendor form respects overrides

For each built-in step component (`OrganizationStep`, `AddressStep`, `ContactStep`, `DocumentVerificationStep`, `FinancialInfrastructureStep`):
- Read `useFormFieldConfigs(tenantId)` and filter by the step's `step_name`.
- Build a `Map<field_name, FormFieldConfig>`.
- Wrap each hardcoded block in a small helper `renderIfVisible(field_name, jsx)` that:
  - Hides the block if the override row has `is_visible = false`.
  - Hides the block if no override row exists (means admin removed/deleted it).
  - Applies `is_mandatory` from override to the validation rule.
- Render any extra admin-added fields (whose `field_name` isn't in the built-in catalog) at the bottom of the tab via a small `DynamicStep`-style renderer so vendors actually see them.

### 4. UX polish in Form Builder

- In the Fields list, show a `Built-in` badge on rows whose `field_name` matches the catalog, so admins know the difference.
- Allow "Edit" on built-in field rows but only for: `display_label`, `placeholder`, `help_text`, `is_visible`, `is_mandatory`, `display_order`. Disable changing `field_name` and `field_type` for built-in fields to avoid breaking the vendor form.
- Allow "Delete" on built-in field rows — deletion removes the row, which the vendor form interprets as "hide this block".
- Add a small "Restore defaults" button per tab that re-seeds any deleted built-in rows.

### 5. Data integrity

- No DB schema changes required — uses the existing `form_field_configs` table.
- Seeding runs only when the tenant has zero rows for that built-in `step_name`, so it is idempotent and safe across reloads and existing tenants that already customised some tabs.

## Files to change

- New: `src/lib/builtInFields.ts` — catalog for the 5 built-in editable tabs.
- `src/pages/FormBuilder.tsx` — auto-seed effect + Built-in badge + restore-defaults button + edit-restrictions for built-in rows.
- `src/components/admin/InlineFieldEditor.tsx` — accept an `isBuiltIn` prop and disable `field_name` / `field_type` inputs accordingly.
- `src/components/vendor/steps/OrganizationStep.tsx`
- `src/components/vendor/steps/AddressStep.tsx`
- `src/components/vendor/steps/ContactStep.tsx`
- `src/components/vendor/steps/DocumentVerificationStep.tsx`
- `src/components/vendor/steps/FinancialInfrastructureStep.tsx`
  Each gets the `renderIfVisible` wrapper + appended dynamic-extras section.

## Out of scope

- No changes to the `review` step (no editable fields there).
- No re-architecture of validation logic — only the `required` flag is wired through to existing yup/zod schemas where applicable; deeper validation logic stays as-is.
