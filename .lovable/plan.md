## Goal

Make the 4 Classification dropdowns (Material Group, Vendor Category, Vendor Location, Identification Source) clearly show:
- **Loading**: "Classification data fetching…" while SAP master data is being read/synced
- **Error**: "Classification fetch failed — <reason>" (e.g. VPN not connected / SAP unreachable / 500 error) with a **Retry** button
- **Empty**: existing "No SAP values — sync SAP master data" hint plus an inline **Sync now** button so users don't have to leave the form
- **Success**: the populated dropdown as today

Apply the same treatment to the Domestic flow (`OrganizationStep.tsx`) and the International flow (`IntlClassificationStep.tsx`).

## Changes

### 1. `src/hooks/useSapMasterData.tsx`
- Return `isLoading`, `isFetching`, `isError`, `error` from the underlying `useQuery` (already there — just consume them in components).
- Add a new helper `useEnsureSapMaster(masterType)` that, on mount, if the cached table is empty for that `master_type`, automatically invokes the `sap-master-fetch` edge function for **just that type** and surfaces:
  - `syncing: boolean`
  - `syncError: string | null` (message returned by the function, e.g. `SAP_SERVICE_UNAVAILABLE`, network failure, missing config — pulled from `data.message` / `data.hint` / thrown error)
  - `retry()` callback
- This way, opening the Organization Profile step triggers the SAP fetch automatically — the user no longer has to navigate to **SAP API Settings → Master Data (F4)** for it to "reflect".

### 2. `supabase/functions/sap-master-fetch/index.ts`
- Ensure the function never throws raw 500s for upstream failures. On SAP fetch/network error, return HTTP 200 with `{ success: false, message: "<reason>", hint: "<actionable>", fallback: true }` per master_type so the frontend can render the exact reason ("VPN not connected", "SAP endpoint timed out", "401 from SAP", etc.).
- Keep the existing `IDENTIFICATION_SOURCE` key fix.

### 3. `src/components/vendor/steps/OrganizationStep.tsx` and `src/components/vendor/steps/international/IntlClassificationStep.tsx`
- Replace the current single placeholder/hint with a small status block per field:
  - While `isLoading || syncing` → disabled `MultiSelect` + spinner + text **"Classification data fetching…"**
  - On `isError || syncError` → red hint **"Classification fetch failed — {reason}"** + **Retry** button that calls `retry()`
  - On empty & not loading → existing hint + **Sync now** button
  - On data → normal multi-select
- Factor the block into a small local `ClassificationField` component to avoid duplication.

## Out of scope

- No DB schema changes.
- No changes to other steps (Address, Contact, Bank, etc.) — Bank Country already has its own SAP-backed dropdown and is unaffected.
- No changes to the SAP API Settings page itself.

## Technical detail

```text
useEnsureSapMaster('material_group_vendor')
  └─ if (!isLoading && data?.length === 0) → mutate refresh
        ├─ success → invalidate query → list re-fetches
        └─ failure → expose syncError to UI
```

The 4 calls run in parallel (React Query dedupes by key), and a single `sap-master-fetch` invocation without `master_type` is preferred when more than one type is empty to batch the SAP round-trip.
