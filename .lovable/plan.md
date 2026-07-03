## Root cause
`SapF4SelectField` (used by Company Code / Rec-Account in SAP Sync) is a **hybrid**: prefer live SAP F4 rows when present, otherwise render from the cached `sap_master_data` table (`useSapMasterData`). See `src/components/sap/SapFieldsDialog.tsx` lines 475–513.

My previous edit stripped the cache fallback out of `IntlCompanyDetailsStep` and made Country/Region **live-only**. On Lovable Cloud the on-prem SAP middleware isn't reachable, so the live call returns empty arrays and there's nothing to render — even though 245 countries and 1583 regions already exist in the cache table.

## Fix: apply the same live-then-cache hybrid to Country/Region

Update `src/components/vendor/steps/international/IntlCompanyDetailsStep.tsx`:

1. **Keep the live fetch on mount** — `sap-master-fetch` with `master_type: ['country','region']`.
2. **Re-add the cache reader** — `useSapMasterData('country')` and `useSapMasterData('region')`.
3. **Per-field source pick** (same rule as `SapF4SelectField`):
   - `countries = liveF4.COUNTRY?.length > 0 ? mapLive() : mapCache()`
   - `regions   = liveF4.REGION?.length  > 0 ? mapLive() : mapCache()` then filter by `LAND1 === selectedCountry`.
   - Mappers pull `LAND1`/`LANDX` for country and `BLAND`/`BEZEI` for region (from top-level fields on live items or from `extra` on cached rows).
4. **Status messaging**
   - Fetching → only when both live and cache are still loading with no rows.
   - Live failed but cache has rows → dropdowns stay enabled; small muted "Using cached SAP values" hint (no red error).
   - Both empty → keep the existing red "Fetch failed — Retry" block.
5. **Payload keys unchanged** — still `LAND1` for country, `BLAND` for region, so the sync payload keeps `"country":"IN","region":"13"`.
6. No changes to the edge function, cache table, or any other screen.

## Files to change
- `src/components/vendor/steps/international/IntlCompanyDetailsStep.tsx`

## Verification
- Lovable Cloud (live unreachable): dropdowns populate from cache; muted "Using cached SAP values" hint appears.
- Self-hosted (live reachable): dropdowns populate from live F4; no cache hint.
- Selecting a country filters regions; submitted payload carries the SAP keys.