Plan to address the SAP F4 issue:

1. **Fix the dropdown showing only one option**
   - Update `SapMasterCombobox` so the search box is independent from the selected value.
   - Right now the selected value is being used as the search text, so opening a field like `ZDOM` filters the list down to matching options only.
   - After the fix, clicking the field will show all loaded F4 options first, and searching will filter only when the user types.

2. **Display SAP fields using the SAP response keys**
   - Render options from the raw SAP row saved in `extra`, using the exact SAP keys:
     - `VENDOR_ACC_GRP`: `KTOKK — TXT30`
     - `COMPANY_CODE`: `BUKRS — BUTXT`
     - `PLANNING_GROUP`: `GRUPP`
     - `RECON_ACCOUNT`: `BUKRS / SAKNR — TXT20`
     - `PURCHASE_ORG`: `EKORG — EKOTX`
     - `CURRENCY`: `WAERS — LTEXT`
   - Keep the selected value as the SAP code needed for the final SAP payload.

3. **Return the raw SAP F4 response from the refresh call**
   - Update the `sap-master-fetch` backend function to include the original SAP response shape in its result, for example:

```json
{
  "VENDOR_ACC_GRP": [{ "KTOKK": "0001", "TXT30": "Vendor" }],
  "COMPANY_CODE": [{ "BUKRS": "0001", "BUTXT": "SAP A.G." }],
  "PLANNING_GROUP": [{ "GRUPP": "A1" }],
  "RECON_ACCOUNT": [{ "BUKRS": "ES01", "SAKNR": "580000", "TXT20": "Travel expenses" }],
  "PURCHASE_ORG": [{ "EKORG": "0001", "EKOTX": "Einkaufsorg. 0001" }],
  "CURRENCY": [{ "WAERS": "ADP", "LTEXT": "Andorran Peseta --> (Old --> EUR)" }]
}
```

4. **Keep cached database fallback, but not as the visible SAP response**
   - The normalized `sap_master_data` table can remain only as a cache for dropdown loading.
   - The user-facing refresh response and option labels will follow SAP’s structure, not the app’s internal normalized design.

Technical details:
- No filtering/matching between fields will be added.
- No change to SAP payload field names unless required by existing sync logic.
- No database migration is needed for this fix because the raw SAP object is already stored in `extra`.