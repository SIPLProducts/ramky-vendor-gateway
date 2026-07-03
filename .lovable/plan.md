## Problem

The SAP sync payload (sample in `sapsending_payload.txt`) currently emits:

```json
"CLASSIFY": {
  ...
  "TIER_CATEGORY": [ { "TIER": "TIER 1" } ]
}
```

The actual SAP contract (`SAP_New_Payload-2.txt` / user spec) expects the last classify block to be named `VENCATEGORY` with inner key `VENCAT`, and the payload must also carry a top‑level `WHOLDTAX` array (withholding tax). `WHOLDTAX` is not yet ready on our side, so we ship it as an empty array `[]` for now — matching SAP's schema so their parser doesn't fail.

## Fix (single file — `src/lib/sapPayloadBuilder.ts`)

1. **Rename the tier classify block** (~L398)
   - Change wrapper key `TIER_CATEGORY` → `VENCATEGORY`
   - Change inner element key from `TIER` → `VENCAT`
   - Source data (`classifyArrays.TIER`, seeded from overrides `classify.TIER` and `vendor.tier_category`) is unchanged — only the emitted JSON shape changes.

   After change, the CLASSIFY block will look like:
   ```json
   "CLASSIFY": {
     "MAT_GRP_VENDOR":        [ { "MGV": "..." } ],
     "CAT_VENDOR":            [ { "CATV": "..." } ],
     "LOCATION_VENDOR":       [ { "LOCV": "..." } ],
     "IDENTIFICATION_SOURCE": [ { "IDS": "..." } ],
     "CASHFLOW":              [ { "CASH": "..." } ],
     "VENCATEGORY":           [ { "VENCAT": "..." } ]
   }
   ```

2. **Add `WHOLDTAX` block** (right after CLASSIFY assignment, ~L399)
   - Set `row.WHOLDTAX = []` unconditionally (empty for now; SAP accepts the empty array).
   - Ensure it isn't overwritten by any existing template field — if the current default template happens to set a `WHOLDTAX`/`wholdtax` key, delete it before assigning so casing is consistent (`WHOLDTAX`).
   - Leave a short code comment: `// TODO: populate WHOLDTAX entries (WITHT / WT_WITHCD / WT_SUBJCT / QSREC / QLAND) once withholding tax capture is wired.`

## Out of scope

- No UI/overrides changes — the "Tier Category" F4 field, its label, and the `TIER` override key stay as-is (only the outbound JSON key is renamed).
- No changes to `sync-vendor-to-sap` / bulk edge functions — they forward the built payload verbatim.
- No DB, migration, or type changes.
- Actual withholding tax data collection and mapping is a separate follow-up.

## Files touched

```text
src/lib/sapPayloadBuilder.ts   (CLASSIFY rename + WHOLDTAX: [])
```
