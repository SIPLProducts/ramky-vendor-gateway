## Plan

1. **Fix only the payload binding logic**
   - Update the SAP sync function so the actual outgoing payload is rebuilt from `overrides.withholding` just before the SAP/middleware call.
   - No deploy script changes.
   - No UI changes unless the backend request shape is proven different.

2. **Map selected override rows exactly into `WHOLDTAX`**
   - For each item in `overrides.withholding`, create one `WHOLDTAX` row:
     - `witht` → `WITHT`
     - `wt_withcd` → `WT_WITHCD`
     - `wt_subjct: true` → `WT_SUBJCT: "X"`
     - `qsrec` → `QSREC`
     - `qland` → `QLAND`
     - `LIFNR` → existing vendor number / payload `LIFNR` if available, otherwise `""`

3. **Prevent empty rows from overriding selected data**
   - Delete/ignore any existing blank `WHOLDTAX` rows from `sapPayload[0]` or templates.
   - Delete lowercase `wholdtax` before sending.
   - Assign the generated array back to both the working row and `payload[0]` so the exact object passed to `fetch()` contains the selected values.

4. **Add a minimal safe verification log**
   - Log selected row count and final mapped `WITHT`, `WT_WITHCD`, `WT_SUBJCT`, `QSREC`, `QLAND` values.
   - This confirms whether the function is receiving overrides and whether the final outgoing payload is correctly bound.

## Expected Result

For your override:

```json
[
  { "witht": "W7", "wt_withcd": "W8", "wt_subjct": true, "qsrec": "CO", "qland": "IN" },
  { "witht": "W2", "wt_withcd": "P2", "wt_subjct": true, "qsrec": "OT", "qland": "IN" }
]
```

The outgoing SAP payload will be:

```json
"WHOLDTAX": [
  { "LIFNR": "", "WITHT": "W7", "WT_WITHCD": "W8", "WT_SUBJCT": "X", "QSREC": "CO", "QLAND": "IN" },
  { "LIFNR": "", "WITHT": "W2", "WT_WITHCD": "P2", "WT_SUBJCT": "X", "QSREC": "OT", "QLAND": "IN" }
]
```

## Scope

I will not change the self-host deploy scripts. This fix is only for binding `overrides.withholding` into the final SAP payload.