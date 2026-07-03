## Goal
Make the **Country** and **Region** dropdowns in the international vendor registration step behave the same way as the **Classification / Company Code** dropdowns in the SAP Sync dialog: fetch **live from SAP F4** on the fly, instead of reading from the cached `sap_master_data` table.

## Why the current version fails
`IntlCompanyDetailsStep.tsx` uses `useEnsureSapMaster('country' | 'region')` which reads rows from the local `sap_master_data` cache table. On self-hosted / fresh environments that cache is empty, so the dropdowns appear blank — even though the SAP Fields F4 API is returning data (as seen in your `sap-master-fetch` response).

Meanwhile, `SapFieldsDialog` (SAP Sync screen) calls `sap-master-fetch` on mount and renders directly from `res.sap_response.COUNTRY` / `.REGION` / `.COMPANY_CODE` / `.CFSTMT` etc. — no dependency on the cache.

## Plan

1. **Refactor `IntlCompanyDetailsStep.tsx`** to load live F4 data on mount:
   - Add `liveF4` state and, in a `useEffect`, invoke the `sap-master-fetch` edge function (same pattern as `SapFieldsDialog` lines 61–107).
   - Track loading / error / retry states locally (fetching, errorMessage, retry handler).
   - Remove the two `useEnsureSapMaster('country' | 'region')` calls.

2. **Render Country dropdown from `liveF4.COUNTRY`**:
   - Each item uses `LAND1` as the SAP key (value sent in payload, e.g. `"IN"`) and `LANDX` / `NATIO` as the display label.
   - Keep the existing shadcn `Select` UI, disabled/placeholder states, and "Fetching from SAP…/Fetch failed — Retry" messaging.

3. **Render Region dropdown from `liveF4.REGION`, filtered by selected country**:
   - Filter items where `extra.LAND1 === selectedCountry` (same rule as today).
   - Value = `BLAND` (SAP region key, e.g. `"13"`); label = `BEZEI` / description.
   - Reset region when country changes (already done).
   - Show "Select country first" / "No regions for this country" states.

4. **Payload compatibility**:
   - Ensure the values persisted are the raw SAP keys (`LAND1`, `BLAND`) so the SAP Sync payload receives `"country": "IN", "region": "13"` as required.

5. **No changes** to the cache table, migrations, or the `sap-master-fetch` edge function. Classification / other cached fields remain unchanged (out of scope).

## Files to change
- `src/components/vendor/steps/international/IntlCompanyDetailsStep.tsx` — swap cache-backed hooks for a live F4 fetch and update Select rendering.

## Verification
- Open international vendor registration → Company Details step: Country populates from live SAP; selecting a country populates matching Regions; on submit, the payload carries the SAP keys (`IN`, `13`).
- If SAP F4 call fails, the fields show a clear "Fetch failed — Retry" message (matching Classification's UX).