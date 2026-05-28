## Goal

Ensure every SAP Business Partner request sends the `CLASSIFY` block in the exact shape SAP expects:

```json
"CLASSIFY": {
  "MAT_GRP_VENDOR":        [{ "MGV":  "..." }, ...],
  "CAT_VENDOR":            [{ "CATV": "..." }, ...],
  "LOCATION_VENDOR":       [{ "LOCV": "..." }, ...],
  "IDENTIFICATION_SOURCE": [{ "IDS":  "..." }, ...]
}
```

…with one wrapper object per selected value, and no stray lowercase `classify` key in the outgoing row.

## Where the bug is

Three places produce or forward the SAP row. Today they don't all guarantee the SAP-shaped `CLASSIFY`:

1. **`src/lib/sapPayloadBuilder.ts`** (client-side builder used by single + bulk SAP Sync) — already has a post-process at lines 254–262, but:
   - emits `[{ MGV: "" }]` when nothing is selected (should emit `[]`),
   - never removes the lowercase `classify` key if a custom template happens to include it,
   - the value isn't trimmed / coerced to string.
2. **`supabase/functions/sync-vendor-to-sap/index.ts`** legacy branch (lines 378–392) — same issues; also when the client passes a fully-resolved `sapPayload` (lines 289–298) the function uses it as-is and never re-normalizes `CLASSIFY`, so an older client or a hand-edited payload can slip through with the wrong shape.
3. **`supabase/functions/sync-vendors-to-sap-bulk/index.ts`** (lines 59–72) — forwards each client row unchanged; needs the same final normalization so bulk sync can't send the wrong shape either.

## Fix

Introduce one shared normalization step (inline helper, no new file) and run it in all three places just before the row is sent to SAP / the middleware.

```ts
// Pseudocode — applied to every outgoing row
const wrap = (arr: string[], key: "MGV" | "CATV" | "LOCV" | "IDS") =>
  (arr || [])
    .map(v => (v == null ? "" : String(v).trim()))
    .filter(Boolean)
    .map(v => ({ [key]: v }));

row.CLASSIFY = {
  MAT_GRP_VENDOR:        wrap(mgv,  "MGV"),
  CAT_VENDOR:            wrap(catv, "CATV"),
  LOCATION_VENDOR:       wrap(locv, "LOCV"),
  IDENTIFICATION_SOURCE: wrap(ids,  "IDS"),
};
delete row.classify; // never leak the lowercase input shape
```

Source arrays (`mgv`, `catv`, `locv`, `ids`) come from the existing `classifyArrays` resolution chain — overrides → vendor columns (`material_group_vendors`, `vendor_categories`, `vendor_locations`, `identification_sources`) → legacy single-value columns → `product_categories` / `registered_state` fallback. That logic already exists; only the final emission changes.

### Edits

1. **`src/lib/sapPayloadBuilder.ts`**
   - Replace the current `expand` helper + assignments at lines 254–262 with the `wrap`-based block above.
   - Add `delete row.classify;` after the CLASSIFY assignment.

2. **`supabase/functions/sync-vendor-to-sap/index.ts`**
   - Same replacement at lines 378–392 (legacy branch).
   - In the client-supplied-payload branch (lines 289–298), re-derive `classifyArrays` from `overrides.classify` + the loaded `vendor` row and run the same `wrap` normalization on `row.CLASSIFY`, then `delete row.classify`. This makes the edge function the single source of truth regardless of what the client sent.

3. **`supabase/functions/sync-vendors-to-sap-bulk/index.ts`**
   - Inside the `sapPayload.map(...)` at lines 59–72, after spreading `...row`, apply the same `wrap`-based `CLASSIFY` rebuild using the matched `vendor` (and `overrides?.classify` if forwarded) and `delete row.classify`.

### Out of scope

- No changes to `SapFieldsDialog`, `MultipleSapSyncDialog`, vendor columns, migrations, or the `sap_payload_templates` rows. The on-the-wire shape is fixed in the builder + edge functions only; templates can keep the existing `{{classify.MGV|upper}}` placeholders because the post-process overwrites `CLASSIFY` unconditionally.
- No UI changes on the SAP Sync screen.

## Verification

- Open SAP Sync → select a vendor with multiple MGV / CATV / LOCV / IDS values → click Sync → check the browser Network tab for the `sync-vendor-to-sap` request body: `sapPayload[0].CLASSIFY` must have all four uppercase keys, each as an array of `{ KEY: value }` objects, and there must be no lowercase `classify` key on the row.
- Repeat with a vendor that has zero classification values selected → each of the four arrays must be `[]` (not `[{ MGV: "" }]`).
- Run a bulk sync with 2+ vendors and confirm each row in the outgoing array has the same correctly shaped `CLASSIFY`.
- Confirm SAP middleware response is `MSGTYP: "S"` and the values appear on the BP in SAP.
