## Plan

1. **Confirm the failing boundary**
   - Treat the attached request as the evidence: `overrides.withholding` contains the selected values, but `sapPayload[0].WHOLDTAX` contains empty rows.
   - This means the table selection is preserved, but the payload builder/template path is producing or carrying blank `WHOLDTAX` rows before the SAP call.

2. **Make backend mapping authoritative**
   - In `sync-vendor-to-sap`, add a single shared `normalizeWholdtax(overrides, vendorCountry)` helper.
   - Apply it immediately before the final SAP/middleware request, after all client payload/template processing.
   - This guarantees the outgoing payload uses:
     - `WITHT` ← `overrides.withholding[].witht`
     - `WT_WITHCD` ← `overrides.withholding[].wt_withcd`
     - `WT_SUBJCT` ← `X` when selected
     - `QSREC` ← `overrides.withholding[].qsrec`
     - `QLAND` ← selected row country or vendor country
   - Remove any lowercase/legacy `wholdtax` key and overwrite stale blank `WHOLDTAX` rows.

3. **Mirror the same safeguard for bulk SAP sync**
   - Ensure `sync-vendors-to-sap-bulk` uses the same final normalization pattern so multiple-vendor sync cannot send blank withholding rows either.

4. **Add safe runtime diagnostics**
   - Log only non-sensitive WHOLDTAX diagnostics in the backend function: selected row count and final mapped codes.
   - Add a small version marker log so the server can prove it is running the updated function code.

5. **Verify deployment path**
   - Update/confirm the self-host deploy script copies latest functions and restarts the functions container.
   - Provide exact server verification commands to confirm the deployed function contains the WHOLDTAX normalization and the container has restarted.

6. **Validation expected result**
   - With the attached payload, the final outgoing SAP payload should contain:
     - `WITHT: W7`, `WT_WITHCD: W8`, `WT_SUBJCT: X`, `QSREC: CO`, `QLAND: IN`
     - `WITHT: W2`, `WT_WITHCD: P2`, `WT_SUBJCT: X`, `QSREC: OT`, `QLAND: IN`

## Technical note
The frontend already sends the selected withholding values under `overrides.withholding`. The fix is to make the backend ignore stale/blank `sapPayload[0].WHOLDTAX` and rebuild `WHOLDTAX` from `overrides.withholding` at the final server-side boundary before SAP is called.