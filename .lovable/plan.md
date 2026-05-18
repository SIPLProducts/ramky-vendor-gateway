## Goal

Send these 4 keys in the SAP sync payload (top-level of the vendor row):

- `idtype`: `"SOLMN1"` (static)
- `idnum`: vendor reference number — first 8 chars of `vendor.id`, uppercase (e.g. `E333F8DC`) — same value shown on the Success screen
- `idtype2`: `"ZMSMEN"` (static)
- `idnum2`: vendor's UDYAM / MSME number (e.g. `UDYAM-AP-04-0057131`) — only when MSME registered, else `""`

Currently the active SAP template maps `idtype`/`idnum` to the MSME pair. We will repurpose `idtype`/`idnum` for the SOLMN1 ticketing pair and move MSME to the new `idtype2`/`idnum2` keys.

## Changes

### 1. Template resolver — add a `reference_no` helper

Both files have an identical resolver. Add a new expression that returns the 8-char uppercase reference from `vendor.id`.

- `supabase/functions/sync-vendor-to-sap/index.ts`
- `src/lib/sapPayloadBuilder.ts`

In `resolveExpr`, alongside the existing `vendor.trade_name_first_word` branch, add:

```ts
} else if (head === "vendor.reference_no") {
  value = String(ctx.vendor?.id || "").slice(0, 8).toUpperCase();
}
```

### 2. Update the active SAP payload template (DB migration)

Update `sap_payload_templates` rows (both tenant-specific and global default) so the top-level row contains:

```json
"idtype":  "SOLMN1",
"idnum":   "{{vendor.reference_no}}",
"idtype2": "ZMSMEN",
"idnum2":  "{{override.idnum2|msme_idnum}}"
```

Leaves the nested `vendors[].idtype/idnum` and `customers[].idtype/idnum` alone (they are already blank strings in the current template).

Migration will do a JSON merge so other fields stay unchanged:

```sql
update public.sap_payload_templates
set template = template
  || jsonb_build_object(
       'idtype',  'SOLMN1',
       'idnum',   '{{vendor.reference_no}}',
       'idtype2', 'ZMSMEN',
       'idnum2',  '{{override.idnum2|msme_idnum}}'
     );
```

### 3. Client-side payload builder fallback

In `src/lib/sapPayloadBuilder.ts`, after the template is resolved (or in the fallback path that builds the row without a template), ensure the same 4 keys are set on `row` so the SOLMN1/reference pair is always present even if a stale template is loaded:

```ts
row.idtype  = "SOLMN1";
row.idnum   = String(vendor.id || "").slice(0, 8).toUpperCase();
row.idtype2 = "ZMSMEN";
row.idnum2  = vendor.msme_number ? String(vendor.msme_number).slice(0, 20) : "";
```

Mirror the same safety net in `supabase/functions/sync-vendor-to-sap/index.ts` right after `row = resolveTemplate(template, ctx)` (next to the existing `row.UPLOAD = []` line).

## Out of scope

- No change to `UPLOAD` handling (stays `[]`).
- No change to `CLASSIFY` blocks.
- No UI changes.
