## Change "Export" to "Domestic" in Accounting Group

Rename the second option of the Accounting Group dropdown from "Export" to "Domestic" everywhere it appears.

**Files to update:**

1. `src/types/vendor.ts`
   - Update the `accountingGroup` type union from `'Import' | 'Export' | ''` to `'Import' | 'Domestic' | ''`
   - Update `ACCOUNTING_GROUPS` constant from `['Import', 'Export']` to `['Import', 'Domestic']`

2. `src/components/vendor/steps/OrganizationStep.tsx`
   - Update Zod enum for `accountingGroup` from `['Import', 'Export']` to `['Import', 'Domestic']`

No changes to ReviewStep (it just renders the stored value), backend, or SAP mappings.
