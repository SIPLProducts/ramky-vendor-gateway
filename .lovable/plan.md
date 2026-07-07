## Fixes for Withholding Tax in SAP Sync

### 1. WTax Code input shows wrong value after picking WTax Type
`SapFieldsDialog.tsx` (WTax Type search `onSelect`, ~line 997-1007) currently pre-fills `wt_withcd` with the selected `TAXTYPE` when the row's code is empty. That's why "W2" appears as the WTax Code even though the user never picked one.

Change:
- On WTax Type select, set `wt_withcd: ''` and `wt_withcd_desc: ''` (also clear `qsrec` / `qsrec_desc` so the row stays consistent). The user must then pick a WTax Code via its own search.
- The manual `Input` for WTax Code stays editable; no other change needed — selecting a code via the WTax Code popup already calls `updateRow(..., { wt_withcd, wt_withcd_desc })`, which will now be the sole source of the value shown.

### 2. Correct WHOLDTAX payload sent to SAP
`src/lib/sapPayloadBuilder.ts` (~line 405-415) currently emits:

```
WT_WITHCD: String(r.wt_withcd ?? r.witht ?? "").trim()
QSREC:     String(r.qsrec ?? "OT").trim()
```

That falls back to `WITHT` for `WT_WITHCD` and to `"OT"` for `QSREC`, which is wrong when the user has explicitly picked values.

Change to use exactly the selected values, matching the requested shape:

```
{
  LIFNR: "",                                      // filled at sync time (unchanged)
  WITHT: r.witht,
  WT_WITHCD: r.wt_withcd,                         // no fallback to witht
  WT_SUBJCT: r.wt_subjct ? "X" : "",
  QSREC: r.qsrec,                                 // no "OT" fallback
  QLAND: r.qland || vendorCountry
}
```

Filter still drops rows with empty `witht`.

### 3. Make WHOLDTAX configurable in SAP API Settings

Today the WHOLDTAX block is hard-coded in `sapPayloadBuilder.ts` and overwrites whatever is in the template. Make it template-driven, the same way other keys are:

- **Default template (`src/lib/sapDefaultTemplate.ts`)**: add a top-level `WHOLDTAX` array with one mapping object using new per-row placeholders:

```
WHOLDTAX: [
  {
    LIFNR: "",
    WITHT: "{{wt.witht}}",
    WT_WITHCD: "{{wt.wt_withcd}}",
    WT_SUBJCT: "{{wt.wt_subjct_flag}}",  // resolves to "X" / ""
    QSREC: "{{wt.qsrec}}",
    QLAND: "{{wt.qland}}"
  }
]
```

- **Builder (`sapPayloadBuilder.ts`)**:
  - Extend `ResolverCtx` with an optional `wt` slot.
  - After resolving the main template, if `row.WHOLDTAX` is an array with one template object, treat that object as a per-row mapping. For each entry in `overrides.withholding` with a non-empty `witht`, build a `wt` context (`witht`, `wt_withcd`, `wt_subjct_flag = wt_subjct ? "X" : ""`, `qsrec`, `qland` defaulted to vendor country) and run the mapping through the existing `resolveTemplate`. Replace `row.WHOLDTAX` with the produced array.
  - Fallback: if the template has no `WHOLDTAX` (older tenants), keep the current hard-coded shape (with the fixes from step 2) so nothing breaks.

- **Template editor** (`SapPayloadTemplateEditor.tsx`): no code change needed — it's already a full JSON editor. Add the new `{{wt.*}}` placeholders to the on-screen helper text next to `{{vendor.*}}`, `{{override.*}}`, `{{classify.*}}`, `{{region(...)}}`, `{{uploads}}` so admins know how to customise WHOLDTAX.

- **Existing tenants**: the seeded row in `sap_payload_templates` won't automatically gain the new `WHOLDTAX` block, but the fallback in the builder keeps them working. Admins can paste the new block via the editor when they want per-field control. No migration required.

### Out of scope
- No changes to `MultipleSapSyncDialog.tsx`, edge functions, or the existing WTax Type / WTax Code / Rec.Type search popups.
- No DB schema changes.

### Files touched
- `src/components/sap/SapFieldsDialog.tsx` — clear WTax Code on WTax Type select.
- `src/lib/sapPayloadBuilder.ts` — correct WHOLDTAX mapping + template-driven path.
- `src/lib/sapDefaultTemplate.ts` — add default `WHOLDTAX` block with `{{wt.*}}` placeholders.
- `src/components/sap/SapPayloadTemplateEditor.tsx` — mention `{{wt.*}}` in helper text.
