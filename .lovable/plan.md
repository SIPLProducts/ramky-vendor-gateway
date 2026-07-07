## Plan

1. **Update single-vendor SAP sync mapping**
   - In `sync-vendor-to-sap`, rebuild `sapPayload[0].WHOLDTAX` directly from `overrides.withholding` at the final point before calling SAP.
   - Ignore any existing blank/stale `sapPayload[0].WHOLDTAX` rows.
   - Remove any legacy lowercase `wholdtax` field so only the correct `WHOLDTAX` is sent.

2. **Apply the exact mapping requested**
   - For every item in `overrides.withholding`, create one `WHOLDTAX` row:
     - `witht` → `WITHT`
     - `wt_withcd` → `WT_WITHCD`
     - `wt_subjct` → `WT_SUBJCT`
     - `qsrec` → `QSREC`
     - `qland` → `QLAND`
     - `LIFNR` → keep existing vendor number logic, fallback to empty string before SAP assigns the vendor code.

3. **Mirror the fix for bulk SAP sync**
   - Apply the same final `WHOLDTAX` generation in `sync-vendors-to-sap-bulk` so both single and bulk sync behave consistently.

4. **Add safe backend diagnostics**
   - Log a small version marker and non-sensitive `WHOLDTAX` summary: selected row count and final mapped codes.
   - This will make it clear from server logs whether the deployed server is running the fixed code.

5. **Verify self-host deployment path**
   - Ensure the deploy script copies the latest edge functions to the self-hosted server functions directory and restarts the functions container.
   - Keep the existing marker check so deployment fails if the WHOLDTAX fix is missing.

## Expected Result

When the request contains:

```json
"overrides": {
  "withholding": [
    {
      "witht": "W7",
      "wt_withcd": "W8",
      "wt_subjct": "X",
      "qsrec": "CO",
      "qland": "IN"
    }
  ]
}
```

The final SAP payload will contain:

```json
"WHOLDTAX": [
  {
    "LIFNR": "",
    "WITHT": "W7",
    "WT_WITHCD": "W8",
    "WT_SUBJCT": "X",
    "QSREC": "CO",
    "QLAND": "IN"
  }
]
```

## Technical Notes

- The frontend selection flow does not need to change because `overrides.withholding` already contains the selected data.
- The fix belongs at the backend final-boundary mapping step, immediately before the SAP/middleware request.
- This prevents any SAP template, stale client payload, or server transform from overwriting selected Withholding Tax values with blanks.