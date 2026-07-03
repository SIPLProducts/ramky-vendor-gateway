## Why this is happening

- The country/region fields depend on `sap_master_data` cached rows for `country` and `region`.
- Your local Lovable environment has those cached rows, so dropdowns show.
- The server URL is returning `COUNTRY: []` and `REGION: []` from the live SAP fetch, and the UI screenshot says the server cache has no rows for those master types.
- Classification appears because it is either already cached/entered separately, while country/region are strictly driven by `country` and `region` master rows.

## Plan

1. **Make country/region behave like classification data**
   - Load country and region directly from cached `sap_master_data` first.
   - Do not block the dropdown just because the live SAP fetch returns empty arrays.
   - Show cached options whenever they exist.

2. **Fix region filtering and value mapping**
   - Country dropdown display: `LAND1 — LANDX`.
   - Country stored/sent value: `LAND1`, for example `IN`.
   - Region dropdown display: `BLAND — BEZEI` filtered by selected country `LAND1`.
   - Region stored/sent value: `BLAND`, for example `13`.
   - SAP sync payload remains:
     ```json
     {
       "country": "IN",
       "region": "13"
     }
     ```

3. **Harden the backend fetch function**
   - If SAP returns empty `COUNTRY`/`REGION` but cached rows exist, return a warning and keep the app usable.
   - If SAP returns empty data and the server cache is empty, return a clear failure message telling exactly which master rows are missing.

4. **Add a server-safe repair path**
   - Add/confirm backend grants for `sap_master_data` so signed-in users can read cached master values.
   - Add a reusable SQL/data repair script or migration note so the self-hosted server can be seeded with the same country/region rows that local Lovable already has.
   - This is necessary because the screenshot is from `206.1.23.95:9009`, which appears to be a separate server environment from the local Lovable preview.

5. **Verify**
   - Confirm `country` has 245 rows and `region` has 1583 rows on the target server/database.
   - Confirm `/sap-master-fetch` no longer reports “no cached values exist” when rows are present.
   - Confirm the vendor registration page shows country options, then region options after a country is selected.
   - Confirm SAP payload sends only keys, not labels.