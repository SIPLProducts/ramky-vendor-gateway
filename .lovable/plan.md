I found two concrete issues causing this:

1. The backend function is receiving `master_type: ["country", "region"]`, but current code wraps it again as `[["country","region"]]`. Because of that it calls the SAP F4 endpoint but then filters out every response key, so `COUNTRY` and `REGION` always come back empty.
2. Cached `sap_master_data` has data already: 245 countries and 1583 regions. But the table has RLS policies without Data API GRANTs, so the frontend may not be allowed to read the cache even though the rows exist.

Plan to fix:

1. Fix `sap-master-fetch` request parsing
   - Accept both formats:
     - `{ "master_type": "country" }`
     - `{ "master_type": ["country", "region"] }`
     - `{ "master_types": ["country", "region"] }`
   - Normalize all of them to a flat string array before deciding which SAP F4 config to call.

2. Make country/region live F4 reliable
   - Keep country/region mapped to `COUNTRY` and `REGION` using SAP fields:
     - Country: `LAND1`, `LANDX`
     - Region: `LAND1`, `BLAND`, `BEZEI`
   - Preserve final form values as SAP codes:
     - country = `LAND1` like `IN`
     - region = `BLAND` like `13`, not `IN_13`
   - If the primary SAP Fields F4 config returns empty for `COUNTRY`/`REGION`, allow the function to also inspect the Classification F4s response when that configured API contains those keys. This matches your requirement that the international card should get live changing SAP F4 data, not depend only on old cache.

3. Fix cached fallback access
   - Add the missing backend grants for `sap_master_data`:
     - authenticated users can read rows
     - admin/service backend can manage rows
   - This does not make the data public; it only lets logged-in users read the cached F4 options according to the existing RLS policy.

4. Keep the registration UI behavior
   - International Company Details will call `sap-master-fetch` on load.
   - If live SAP returns country/region rows, dropdown shows live rows.
   - If SAP returns empty or fails, dropdown falls back to cached rows.
   - If both live and cache are unavailable, show the retry/sync message.

5. Verify after implementation
   - Call the function with your exact payload and confirm `COUNTRY`/`REGION` are no longer forced empty by the array parsing bug.
   - Confirm cache rows are readable from the frontend.
   - Check the international vendor country and region dropdowns show options.