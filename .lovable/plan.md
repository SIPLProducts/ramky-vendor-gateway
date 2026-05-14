## Findings
- The SAP Sync popup opens and reads existing F4 rows from `sap_master_data`.
- The F4 refresh function is being called when the popup opens, but it is silent and does not surface status inside the popup.
- Current stored master data has values for vendor account group, company code, planning group, and recon account, but purchase org and currency are missing.
- Rec-Account is filtered by selected company code `1000`; there are no recon-account rows with `BUKRS = 1000`, so that dropdown can look empty even though recon-account data exists for other company codes.
- The user-visible issue is likely a combination of: no in-popup refresh status, missing master types, and strict filtering/default mismatches.

## Plan
1. Update the SAP Field Confirmation popup to explicitly show F4 refresh status when it opens:
   - loading message while the SAP Fields F4 API is running
   - success count after refresh
   - clear error message if the refresh fails

2. Make each SAP F4 dropdown more transparent:
   - show how many options are loaded for the field
   - show a better empty state when no options match the current filter
   - for Rec-Account, show that it is filtered by Company Code and allow the user to understand why it is empty

3. Improve F4 refresh reliability in frontend state:
   - after `sap-master-fetch` completes, invalidate/refetch the master-data queries used by all open comboboxes
   - ensure dropdowns update without needing to close/reopen the popup

4. Adjust Rec-Account filtering behavior safely:
   - keep company-code filtering when matching rows exist
   - if no row exists for the selected company code, show all recon accounts instead of an empty dropdown, with a small hint that no company-specific match was found

5. Validate in the browser:
   - open SAP Sync popup
   - confirm the `sap-master-fetch` request fires
   - open Vendor Account Group, Company Code, Planning Group, Rec-Account, Purchase Org, and Currency dropdowns
   - verify options or clear empty-state messages are visible

## Technical notes
- Main files to change:
  - `src/components/sap/SapFieldsDialog.tsx`
  - `src/components/sap/SapMasterCombobox.tsx`
  - `src/hooks/useSapMasterData.tsx`
- No database schema change is required.