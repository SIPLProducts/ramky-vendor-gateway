## Root cause found

1. The six SAP F4 fields are already using a custom combobox component. In HTML/devtools it appears as a `<button role="combobox">`, which is normal for shadcn/Radix dropdown controls, but it is still a dropdown behaviorally.
2. Values are preselected because `SapFieldsDialog.buildDefaults()` hardcodes defaults:
   - `partn_grp = ZDOM`
   - `bukrs = 1000`
   - `akont = 155000005`
   - `fdgrv = A1`
   - `vkorg = 1000`
   - `waers = INR`
3. The selected SAP payload keys are correctly named as you listed:
   - Vendor Account Group → `partn_grp`
   - Company Code → `bukrs`
   - Planning Group → `fdgrv`
   - Rec-Account → `akont`
   - Purchase Org → `vkorg`
   - Currency → `waers`
4. The live F4 response arrays are being passed to these fields, but the UI currently auto-selects the default SAP values instead of showing an empty “Select…” dropdown first.

## Implementation plan

### 1. Remove hardcoded preselection for the six F4 dropdowns
Update `SapFieldsDialog.buildDefaults()` so these fields start empty unless saved tenant defaults exist:

- `partn_grp`
- `bukrs`
- `akont`
- `fdgrv`
- `vkorg`
- `waers`

This means when Prepare & Sync opens, the dropdowns will show placeholders instead of automatically selecting ZDOM / 1000 / A1 / INR.

### 2. Keep the SAP payload key mapping exactly as required
No payload key rename is needed. The existing form already stores selections in the keys SAP expects:

```text
VENDOR_ACC_GRP selected value -> partn_grp
COMPANY_CODE selected value   -> bukrs
PLANNING_GROUP selected value -> fdgrv
RECON_ACCOUNT selected value  -> akont
PURCHASE_ORG selected value   -> vkorg
CURRENCY selected value       -> waers
```

### 3. Make the dropdown UI clearer
Keep the accessible combobox implementation, but change the visible behavior/text so it clearly looks and acts like a dropdown:

- Show `Select Vendor Account Group`, `Select Company Code`, etc. when empty.
- Keep the chevron and search list.
- Use the live SAP F4 response first, cached rows only as fallback.
- Keep option labels from SAP response:
  - `KTOKK — TXT30`
  - `BUKRS — BUTXT`
  - `GRUPP`
  - `BUKRS / SAKNR — TXT20`
  - `EKORG — EKOTX`
  - `WAERS — LTEXT`

### 4. Fix selected value matching for Rec-Account if needed
For Rec-Account, the dropdown currently stores only `SAKNR` as `akont`, while the label displays `BUKRS / SAKNR`. I will keep payload value as only `akont = SAKNR`, because your SAP key says `akont: "155000005"`.

### 5. Validate the flow
After implementation, verify from code behavior that:

- Prepare & Sync waits for SAP Fields F4.
- All six fields are dropdowns populated from:
  - `VENDOR_ACC_GRP`
  - `COMPANY_CODE`
  - `PLANNING_GROUP`
  - `RECON_ACCOUNT`
  - `PURCHASE_ORG`
  - `CURRENCY`
- No hardcoded values are preselected for these six fields unless tenant defaults are configured.
- Confirm Sync still sends the selected values under `partn_grp`, `bukrs`, `fdgrv`, `akont`, `vkorg`, and `waers`.