## Goal
Simplify the SAP Field Confirmation dialog (`src/components/sap/SapFieldsDialog.tsx`) to match the reference sheet (image 3). Remove the vendor name from the title and drop unused fields/sections.

## Changes in `src/components/sap/SapFieldsDialog.tsx`

1. **Dialog title** — change to just:
   `SAP Field Confirmation`
   (remove `— {vendor?.legal_name}`)

2. **Vendor Header section** — keep only:
   - Vendor (Person/Organization/Group) → `partn_cat`
   - Vendor Account Group → `partn_grp`
   - MSME (Minority Indicator) → `msme`

   Remove: Title, GST Category, MSME Reg Type (idtype), MSME ID Number (idnum).

3. **Company Code Data section** — keep:
   - Company Code, Rec-Account, Sort Key, Planning Group, Check Duplicate Invoice
   (already matches — no change)

4. **Purchase Data section** — keep:
   - Purchase Org, Currency, Group for Calc Schema (Supplier), Vendor Class, GR-Based Invoice Verification, Service-Based Invoice Verification
   (already matches — no change)

5. **Classification section** — remove the entire section (and its preceding `<Separator />`). Also drop the `Tags` icon import since it's no longer used.

6. **`SapFieldOverrides` type & `buildDefaults`** — keep the removed keys (`title`, `taxtype`, `idtype`, `idnum`, `classify`) so the existing payload builder in `useVendors.tsx` / edge function continues to receive the same defaults silently. They simply won't be user-editable anymore. This avoids touching the SAP payload pipeline.

## Result
Popup shows exactly the 14 columns from the reference sheet, grouped into Vendor Header / Company Code Data / Purchase Data, with no Classification block and a cleaner generic title.
