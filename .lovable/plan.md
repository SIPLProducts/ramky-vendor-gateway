## Root cause

Local (Lovable) sends the correct `WHOLDTAX` array; the self-hosted server sends two empty rows. That difference is produced entirely by the **browser** — the edge function currently trusts whatever `sapPayload` the client posts and only re-normalizes `CLASSIFY`, never `WHOLDTAX`.

Two things combine on your server:

1. **Stale frontend build.** The current `src/lib/sapPayloadBuilder.ts` (lines 404–436) overwrites `row.WHOLDTAX` from `overrides.withholding` before sending. The server's built frontend predates that logic, so it emits the template's static `WHOLDTAX` (two empty rows) instead.
2. **Legacy stored template.** `sap_payload_templates.template.WHOLDTAX` on that server still contains two hardcoded empty entries. That is why you see *exactly two* empty rows in the SAP request — it's the template shape, not user input.

Locally both are already up-to-date, so it works.

## Fix

Make the edge function the source of truth for `WHOLDTAX`, so it is correct even when the deployed frontend or stored template is stale. Then rebuild the frontend on the server.

### 1. `supabase/functions/sync-vendor-to-sap/index.ts` — client-supplied branch (~L381–440)

After `row = clientPayload[0]`, rebuild `row.WHOLDTAX` from `overrides.withholding` using the same rules as the client builder:

- Filter to rows where `witht` is truthy.
- Emit one entry per row:
  ```
  {
    LIFNR: "",
    WITHT:     String(r.witht).trim(),
    WT_WITHCD: String(r.wt_withcd || "").trim(),
    WT_SUBJCT: r.wt_subjct ? "X" : "",
    QSREC:     String(r.qsrec || "").trim(),
    QLAND:     String(r.qland || vendorCountry || "IN").trim(),
  }
  ```
- If `overrides.withholding` is missing/empty, set `row.WHOLDTAX = []` (never leave the template's static empties).
- Delete any lowercase `wholdtax` key.

### 2. `supabase/functions/sync-vendors-to-sap-bulk/index.ts` — enrichment loop (~L95)

Same treatment inside the `sapPayload.map` loop, using each row's `withholding` override (the bulk caller sends the shared `overrides` object; read `withholding` from it and apply per row). Ensure `WHOLDTAX` in the enriched row is always the freshly-built array (or `[]`), never the template's empties.

### 3. `src/lib/sapPayloadBuilder.ts`

No behavior change; add a short comment noting the server also re-normalizes `WHOLDTAX` so stale client bundles still produce a correct SAP request.

### 4. Server-side follow-ups (surfaced in the reply, not code changes)

- Rebuild and redeploy the **frontend** on the self-hosted server so the client also sends correct `WHOLDTAX` (belt-and-braces).
- Optionally clean up `sap_payload_templates` on that server: remove the static `WHOLDTAX` block from the stored template so it is always constructed by code.

## Verification

- On the self-hosted server, open SAP Sync, select two withholding rows in the popup, submit.
- Inspect the outgoing SAP request: `WHOLDTAX` should now contain the selected `WITHT / WT_WITHCD / WT_SUBJCT / QSREC / QLAND`, matching your local example.
- With zero rows selected, `WHOLDTAX` must be `[]`, not two empty rows.
- Local behavior unchanged.
