# Show Vendor-Sourced Fields (Read-Only) in SAP Field Confirmation Dialog

The SAP Field Confirmation dialog (`SapFieldsDialog.tsx`) currently only shows editable SAP control fields (account groups, company codes, etc.). It must additionally display the vendor-registration data that is being synced to SAP, in **disabled / read-only** mode, so the approver can review what will actually be pushed.

## Sections to add (all fields disabled, sourced from the `VendorRow`)

The dialog already has the sections **Vendor Header**, **Company Code Data**, **Purchase Data**. We will add the new fields into the existing grid and add three new sections below.

### 1. Vendor Header — add disabled fields
- Trade Name → `vendor.trade_name`
- GST ID (GSTIN) → `vendor.gstin`
- PAN Number → `vendor.pan_number`
- Udyam (MSME) Number → `vendor.msme_number`

### 2. New section — "Bank Details" (disabled)
- Bank Account Number → `account_number`
- Bank ID (IFSC Code) → `ifsc_code`
- Account Holder Name → `account_holder_name`
- Bank Name → `bank_name`

### 3. Classification (already partially present; promote to its own visible disabled block)
- Material Category → `classify.MGV` (existing, keep editable as today)
- Vendor Category → `classify.CATV`
- Vendor Location → `classify.LOCV` (defaults from `registered_state`)
- Vendor Identification → `classify.IDS`

These remain in the existing `classify` form state. (No change requested to editable behavior — only ensure the section is rendered.)

### 4. New section — "Registered / Corporate Office Address" (disabled)
Show all address fields except Fax, Website, Email:
- Address Line 1 → `registered_address`
- Address Line 2 → `registered_address_line2`
- Address Line 3 → `registered_address_line3`
- Address Line 4 → `registered_address_line4`
- City → `registered_city`
- State → `registered_state`
- Pincode → `registered_pincode`
- Phone → `registered_phone`

### 5. New section — "Contact Details" (disabled)
- Contact Number → `vendor.contact_phone` (or `registered_phone` fallback)
- Email ID → `vendor.contact_email` (or `registered_email` fallback)

## Technical Notes

- File to edit: `src/components/sap/SapFieldsDialog.tsx`.
- Add a small `ReadOnlyField` helper that renders a `Label` + `Input` with `disabled` and `value={vendor?.<field> || '—'}`, styled with the existing `h-9 rounded-lg` classes plus `bg-muted/40 text-muted-foreground` to make the disabled state visually distinct (semantic tokens, no hardcoded colors).
- Use the existing `Section` / grid pattern (`md:grid-cols-2`) for consistency.
- Place the new sections inside the existing scrollable container, separated by `<Separator />`.
- These fields are **display only** — they are NOT added to `SapFieldOverrides` and are NOT included in `onConfirm` payload (sync logic already pulls them from the vendor record).
- No backend, schema, or sync-logic changes.
- No changes to the editable SAP control fields already in the dialog.

## Out of scope
- No changes to `sync-vendor-to-sap` edge function.
- No changes to vendor registration forms.
- No changes to approval workflow.
