## Root cause

`supabase/functions/sap-master-fetch/index.ts` requires roles `admin / sharvi_admin / customer_admin / finance / SAP Team`. Vendors filling the registration form don't have any of these roles, so `supabase.functions.invoke("sap-master-fetch")` returns **HTTP 403** — surfaced in the UI as *"Classification fetch failed — Edge Function returned a non-2xx status code."*

The Country / Region dropdowns on the International Company Details step hit the exact same wall and additionally have **no retry UI** at all — they just sit disabled with "No SAP values — sync SAP master data".

## Changes

### 1. `supabase/functions/sap-master-fetch/index.ts`
- Remove the role allowlist on `requireAuthenticatedUser`. Keep authentication required (any signed-in user), drop the role check.
  - Before: `requireAuthenticatedUser(req, ["admin","sharvi_admin","customer_admin","finance","SAP Team"])`
  - After: `requireAuthenticatedUser(req)`
- Safe because the function only **reads** from SAP and **upserts** into `sap_master_data`, which is already a vendor-readable shared cache. No destructive operations exist.
- Redeploy the function.

### 2. `src/components/vendor/steps/international/IntlCompanyDetailsStep.tsx`
- Swap `useSapMasterData('country')` → `useEnsureSapMaster('country')` and `useSapMasterData('region')` → `useEnsureSapMaster('region')`.
- For both Country and Region, render the same status pattern already used by `ClassificationField`:
  - `fetching` → disable `Select`, placeholder "Fetching country/region from SAP…", show spinner + helper text.
  - `errorMessage` → red helper text "Country/Region fetch failed — {reason}" with a **Retry** button (`RefreshCw` icon) wired to `retry()`.
  - empty (not fetching, no error, zero rows) → existing "No SAP values" hint + **Sync now** button calling `retry()`.
- Country `Select` is disabled while `fetching || errorMessage || empty`. Region keeps its "Select country first" gating in addition to its own loading/error/empty states.
- Keep all logic inline in this file (single usage — no new shared component).

### 3. Out of scope
- `ClassificationField`, `OrganizationStep`, `IntlClassificationStep`, `useSapMasterData`, RLS, schema, and the SAP API Settings page are unchanged.

## Result

- Vendors opening **Organization Profile** or **International → Company Details** auto-trigger the SAP F4 fetch successfully (no more 403).
- If the SAP/VPN side actually fails (timeout, 401 to SAP, middleware down), all 6 fields (4 classifications + Country + Region) show the same clear flow: *"… fetching from SAP…" → "… fetch failed — {reason}" → **Retry***.
