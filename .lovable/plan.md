## What is happening today

- Click on **Prepare & Sync** opens **SAP Field Confirmation** and triggers `sap-master-fetch` (which calls the `SAP Fields F4` API via the Node middleware in proxy mode).
- The dropdowns (`Vendor Account Group`, `Company Code`, `Planning Group`, `Rec-Account`, `Purchase Org`, `Currency`) are SAP master comboboxes (`SapMasterCombobox`). They render correctly as dropdowns and show "159 / 534 / 14 options loaded" — but those values come from the **cached `sap_master_data` table**, not from the live F4 response.
- The live refresh in your screenshot fails with `Middleware HTTP 401: Unauthorized`. That comes from `middleware/server.js`, which logs `[WARN] MIDDLEWARE_SHARED_SECRET is not set — refusing all authenticated requests.` So the live F4 call never reaches SAP, and the dialog only falls back to old cached data.
- The edge function already returns the full F4 JSON (`sap_response: { VENDOR_ACC_GRP, COMPANY_CODE, PLANNING_GROUP, RECON_ACCOUNT, PURCHASE_ORG, CURRENCY }`), but the UI is not consuming it directly — it relies entirely on the DB cache.

So two real problems to fix:

1. The dropdowns must be bound from the **live F4 response** when the user clicks Prepare & Sync, after waiting for it to arrive.
2. The middleware 401 must be surfaced with a precise, fix-it message (it is an env/config issue, not a code bug — the local middleware needs `MIDDLEWARE_SHARED_SECRET` set to the same value as the Proxy Secret in `SAP API Settings → SAP Fields F4`).

## Plan

### 1. Bind dropdowns from the live F4 response

- In `SapFieldsDialog`:
  - Show a clean blocking loader (spinner + "Fetching F4 options from SAP…") in the body while the F4 call is in flight. Hide the form until the response arrives or fails.
  - Increase the soft-timeout from 20s to 60s (SAP F4 can be slow; current Postman call took ~1.8s but production can be slower).
  - On success, capture `sap_response` from `sap-master-fetch` and pass it down as `liveOptions` to each `SapMasterCombobox`.
  - On failure, fall back to DB cache and show the precise error returned by the edge function (the message + hint).

### 2. Make `SapMasterCombobox` accept live options

- Add an optional `liveItems?: any[]` prop. When provided, it takes precedence over the cached DB rows.
- Reuse the existing `buildLabel` logic (it already understands `KTOKK / TXT30`, `BUKRS / BUTXT`, `GRUPP`, `BUKRS + SAKNR / TXT20`, `EKORG / EKOTX`, `WAERS / LTEXT`).
- The wiring per dropdown:
  - Vendor Account Group ← `sap_response.VENDOR_ACC_GRP`
  - Company Code ← `sap_response.COMPANY_CODE`
  - Planning Group ← `sap_response.PLANNING_GROUP`
  - Rec-Account ← `sap_response.RECON_ACCOUNT`
  - Purchase Org ← `sap_response.PURCHASE_ORG`
  - Currency ← `sap_response.CURRENCY`
- Footer text becomes `"<n> options loaded from live SAP F4."` when live, otherwise the existing cached count.

### 3. Improve the middleware 401 message

- In `sap-master-fetch`, when the middleware returns 401, return a specific message:
  - `Middleware rejected the request (HTTP 401). The Node middleware running on <middleware_url> needs MIDDLEWARE_SHARED_SECRET set to the same value as the Proxy Secret saved in SAP API Settings → SAP Fields F4. Restart the middleware after setting it.`
- Surface that message verbatim in the dialog banner so the operator knows exactly what to do.

### 4. Validate

- Direct `supabase--curl_edge_functions` call to `sap-master-fetch` and confirm `sap_response` is returned with all six arrays once the middleware secret is fixed.
- Open Prepare & Sync in the preview, confirm the form is hidden until the response arrives, then confirm each dropdown shows the live counts and items.
- Confirm the saved selection (`code`) remains compatible with the current `SAP Fields F4` keys.

## Out of scope

- No changes to the actual SAP API config, the proxy URL, or credentials — those are admin-side settings.
- No changes to how the synced vendor payload is built; only the F4 dropdown source changes.
