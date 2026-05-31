I found the issue in the SAP popup dropdown component: `Rec-Account` uses only `SAKNR` as the select value, but the live SAP response can contain the same `SAKNR` under multiple Company Codes (`BUKRS`). That causes the select display to resolve against the wrong option or not show the selected value reliably.

Plan:

1. Update the shared SAP F4 dropdown component in `SapFieldsDialog.tsx`
   - Add support for filtering live/cached options by a parent field, e.g. `BUKRS = selected Company Code`.
   - Keep the selected value as the actual SAP field value (`SAKNR`) so the SAP payload remains unchanged.
   - De-duplicate options after filtering so repeated records do not break the select trigger display.
   - Show a clear empty-state message when a dependent field needs Company Code first.

2. Fix `Rec-Account*` in the single SAP Sync popup
   - Filter `RECON_ACCOUNT` options by the selected `Company Code`.
   - Display the selected Rec-Account value immediately after selection.
   - If a configured default Rec-Account is valid for the default Company Code, show it automatically when the popup opens.
   - If the Company Code changes and the current Rec-Account is not valid for the new Company Code, clear it so the user must select a valid account.

3. Apply the same dependent logic to the multiple SAP Sync popup
   - Keep bulk sync behavior consistent with the single-vendor popup.
   - Filter Rec-Account by Company Code and clear invalid selections when Company Code changes.

4. Validate the behavior
   - Confirm Company Code selection refreshes the Rec-Account list automatically.
   - Confirm dependent dropdowns only show records for the selected Company Code.
   - Confirm default values display correctly when valid and do not display stale/invalid values after Company Code changes.