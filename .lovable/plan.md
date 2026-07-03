## Goal
Fix the International Vendor country and region dropdowns so they read the existing cached SAP master rows and send the SAP sync payload as:

```json
{
  "country": "IN",
  "region": "13"
}
```

## Findings
- The database already contains SAP master data: 245 country rows and 1583 region rows.
- The dropdown query is blocked because `public.sap_master_data` still has no Data API table grants, even though row-level read policy exists.
- The external `sap-master-fetch` test returned empty `sap_response.COUNTRY` / `REGION`, but the cached master rows already exist, so the immediate dropdown issue is database access, not missing master data.
- The SAP fetch function also returns `success: true` with empty arrays when SAP returns no data, which makes failures look successful.

## Implementation Plan
1. **Apply missing backend grants**
   - Add explicit access grants on `public.sap_master_data` for signed-in app users and backend functions.
   - Keep existing row-level rules unchanged: signed-in users can read; only admin-like roles can manage rows.

2. **Harden `sap-master-fetch` response handling**
   - If a requested type like `country` returns zero SAP rows but cached rows already exist, keep using the cache and return a clear warning instead of making the UI look broken.
   - If SAP returns zero rows and no cache exists, return `success: false` with a clear message.

3. **Confirm country/region value mapping**
   - Country dropdown continues to display `LAND1 — LANDX` and stores `LAND1`.
   - Region dropdown continues to filter by selected country and stores `BLAND`, so SAP sync sends `country: LAND1`, `region: BLAND`.

4. **Verify**
   - Re-check grants on `sap_master_data`.
   - Re-check cached country/region counts through the app-accessible path.
   - Test `sap-master-fetch` for `master_type: country` and confirm the response no longer masks empty SAP results as a clean success.