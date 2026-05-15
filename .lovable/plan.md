## Plan

1. **Replace the six SAP F4 controls with actual select dropdowns**
   - In the SAP Field Confirmation popup, replace `SapMasterCombobox` usage for these six fields with Radix/shadcn `Select` controls:
     - Vendor Account Group
     - Company Code
     - Planning Group
     - Rec-Account
     - Purchase Org
     - Currency
   - This removes the visible `button role="combobox"` trigger that is causing confusion and uses the app’s normal dropdown component instead.

2. **Bind each dropdown directly to the correct SAP F4 response array**
   - Vendor Account Group → `liveF4.VENDOR_ACC_GRP`
   - Company Code → `liveF4.COMPANY_CODE`
   - Planning Group → `liveF4.PLANNING_GROUP`
   - Rec-Account → `liveF4.RECON_ACCOUNT`
   - Purchase Org → `liveF4.PURCHASE_ORG`
   - Currency → `liveF4.CURRENCY`

3. **Map selected option values to the required SAP payload keys**
   - `VENDOR_ACC_GRP.KTOKK` → `partn_grp`
   - `COMPANY_CODE.BUKRS` → `bukrs`
   - `PLANNING_GROUP.GRUPP` → `fdgrv`
   - `RECON_ACCOUNT.SAKNR` → `akont`
   - `PURCHASE_ORG.EKORG` → `vkorg`
   - `CURRENCY.WAERS` → `waers`

4. **Show readable dropdown labels from SAP response fields**
   - Vendor Account Group: `KTOKK — TXT30`
   - Company Code: `BUKRS — BUTXT`
   - Planning Group: `GRUPP`
   - Rec-Account: `BUKRS / SAKNR — TXT20`
   - Purchase Org: `EKORG — EKOTX`
   - Currency: `WAERS — LTEXT`

5. **Ensure popup waits for the F4 API before showing the SAP field form**
   - Keep the current loading state while `SAP Fields F4` is being called.
   - Once the response arrives, automatically populate all six dropdowns from that response.
   - If the API fails, keep the existing cached fallback behavior so users can still proceed when cached values exist.

6. **Keep no hardcoded preselection for the six F4 fields**
   - Keep these values empty on popup open unless tenant defaults exist:
     - `partn_grp`, `bukrs`, `fdgrv`, `akont`, `vkorg`, `waers`
   - The dropdown should display `Select ...` until the user chooses a value.

## Technical details

- Update `src/components/sap/SapFieldsDialog.tsx` to render a new reusable `SapF4SelectField` helper for the six fields.
- The helper will use the existing `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, and `SelectItem` UI components.
- Use live SAP F4 arrays first; when live arrays are unavailable after an error, use the existing cached master-data rows as fallback.
- Keep `onConfirm(form)` unchanged so the final sync payload still sends the selected values under the existing SAP keys.