## Goal
When a user clicks **Sync** on the SAP Sync screen, the app should call the new **RAMKY VMS – Create Business Partner** API documented in the PDF, using the full lowercase-keyed payload and the new credentials, then show success/failure based on the response.

## What changes

### 1. SAP endpoint + credentials (secrets, not hardcoded)
The PDF gives:
- URL: `http://10.200.1.2:8000/vendor/bp/create?sap-client=300`
- User: `22000208`, Password: `Nani@1432`
- Method: `POST`, Basic Auth

Because the URL is an **internal IP** and credentials may change, store them as Lovable Cloud secrets instead of hardcoding:
- `SAP_BP_API_URL`
- `SAP_BP_USERNAME`
- `SAP_BP_PASSWORD`

We will request these via the secret tool. (If you want, we can pre-seed them with the PDF values.)

> Note: `10.200.1.2` is a private IP. Edge Functions run on the public internet and won't be able to reach it unless the SAP host is exposed publicly or via a tunnel/proxy (e.g. the existing middleware/Cloudflare Worker mentioned in the codebase). We'll keep the URL configurable so you can point it at a public/proxy URL when ready. Sync will return a clear network error if the host isn't reachable.

### 2. Rewrite the edge function `sync-vendor-to-sap`
Replace the current implementation (which uses old uppercase keys, hardcoded URL/creds and company code 1710) with the new mapping:

- Read vendor + bank details from the database.
- Build a **single-element JSON array** with all lowercase keys exactly as in the PDF (`bpartner`, `partn_cat`, `partn_grp`, `name1`…`taxkd07`).
- Apply the field-length truncations from the PDF spec table (e.g. `name1`/`name2` ≤ 40, `street` ≤ 60, `taxnumxl` ≤ 20, `bank_acct` ≤ 18, etc.).
- Map vendor data:
  - `name1` ← `legal_name`, `name2` ← `trade_name`, `sterm1` ← `legal_name`, `sterm2` ← first word of trade name
  - `street`, `str_suppl1`, `str_suppl2`, `city`, `postl_cod1`, `country`="IN", `region` ← state→SAP region code (reuse existing map; default fallback)
  - `mob_number` ← `primary_phone`, `tel_number` ← `registered_phone`, `smtp_addr` ← `primary_email`
  - `taxtype`="IN3", `taxnumxl` ← `gstin`
  - `bankdetailid`="0001", `bank_ctry`="IN", `bank_key` ← IFSC (or blank if not derivable), `bank_acct` ← `account_number`, `accountholder` ← `legal_name`
  - `bukrs`="1000", `akont`="155000005", `zuawa`="014", `cdi`="X", `fdgrv`="A1"
  - `msme` ← "MIC" if MSME provided else blank
  - `j_1ipanno` ← `pan`
  - `vkorg`="1000", `waers`="INR", `kalsk`="L1", `webre`="X", `lebre`="X"
  - `partn_cat`="2", `partn_grp`="ZDOM", `langu`="EN"
  - All other fields default to empty strings (per PDF sample).
- POST as JSON array, with `Authorization: Basic base64(user:pass)` and `Content-Type: application/json`.
- Parse the response array. Treat as **success** when any item has `MSGTYP==="S"` and `MSG` contains "Business Partner Created". Pull `BP_LIFNR` as the SAP vendor code.
- On success: update `vendors` row with `sap_vendor_code`, `sap_synced_at = now()`, `status = 'sap_synced'`, then return `{ success:true, sapVendorCode, sapResponse, message }`.
- On failure (HTTP error, `MSGTYP==="E"`, or unreachable host): return `{ success:false, message, sapResponse? }` with HTTP 200 so the client can render the error nicely.
- Log full request/response to function logs for debugging.

### 3. Frontend (SAP Sync screen)
No structural changes needed — `useSAPSync` already calls `sync-vendor-to-sap` and the screen already shows the result dialog. We will:
- Make sure the result dialog correctly renders the new response shape (it already iterates `sapResponse[]` showing `MSGTYP`, `MSG`, `BP_LIFNR`).
- Show the failure message when `success:false` (currently it just throws — we'll surface the SAP error message in a toast and still open the result dialog so you can see the SAP message like `"No Bank Key Available"`).

### 4. Audit log
Keep the existing `audit_logs` insert with `action: 'sap_sync'` and the SAP response payload.

## Out of scope
- No DB migrations (vendor table already has `sap_vendor_code`, `sap_synced_at`, `status`).
- No changes to the SAP API Settings screen (that remains a separate config tool).
- No UI redesign of the SAP Sync page.

## Files to change
- `supabase/functions/sync-vendor-to-sap/index.ts` — rewrite payload + auth + URL from secrets.
- `src/pages/SAPSync.tsx` — small tweak to show failure messages from the new response shape.
- `src/hooks/useVendors.tsx` — small tweak so failures don't lose the `sapResponse` for the dialog.

## Open question
Do you want me to use the PDF credentials/URL **as the secret defaults** (so it works immediately), or should I just create empty secrets and have you paste the values yourself?
