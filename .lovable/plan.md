# Reorder SAP Field Confirmation Dialog

In `src/components/sap/SapFieldsDialog.tsx`, reorder the sections inside the scrollable container so the newly added vendor-sourced (disabled) fields appear FIRST, and the existing editable SAP control fields appear BELOW them.

## New section order (top → bottom)

1. **Vendor Information** (read-only, vendor-sourced) — Trade Name, GST ID (GSTIN), PAN Number, Udyam Number (MSME)
2. **Bank Details** (read-only) — Bank Account Number, Bank ID (IFSC Code), Account Holder Name, Bank Name
3. **Registered / Corporate Office Address** (read-only) — Address Line 1–4, City, State, Pincode, Phone
4. **Contact Details** (read-only) — Contact Number, Email ID
5. — separator —
6. **Vendor Header** (editable SAP) — Vendor (Person/Org/Group), Vendor Account Group, MSME (Minority Indicator)
7. **Company Code Data** (editable) — unchanged
8. **Purchase Data** (editable) — unchanged
9. **Classification** (editable) — unchanged

## Technical notes

- Pure presentational change. Move JSX blocks within the existing scroll container; keep `<Separator />` between groups.
- Split the current "Vendor Header" section: editable SAP fields stay in "Vendor Header" (moved below); the four read-only vendor identity fields move into a new top section called "Vendor Information".
- No changes to `SapFieldOverrides`, `buildDefaults`, `onConfirm` payload, `ReadOnlyField` helper, styling, or sync logic.

## Out of scope

- No backend, schema, or sync-vendor-to-sap edge function changes.
- No new fields added or removed.
