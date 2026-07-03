## Problem

`SapF4SelectField` and `SapF4MultiSelectField` in `src/components/sap/SapFieldsDialog.tsx` decide "is live data?" with `Array.isArray(liveItems)`. The `sap-master-fetch` edge function always returns every known key in `sap_response`, defaulting missing ones to `[]`. So when the Classification F4s middleware call fails (401), `liveF4.CFSTMT` and `liveF4.CP_TIER` come back as `[]` — the field treats that as "live is present" and bypasses the cached `sap_master_data` (which actually has 36 CFSTMT + 3 CP_TIER rows). Same pattern affects Country/Region and every other F4 field when their live array is empty.

## Fix

Single change, UI only. In `src/components/sap/SapFieldsDialog.tsx`:

- Change the "live" check in **both** `SapF4SelectField` and `SapF4MultiSelectField` from:
  ```
  const isLive = Array.isArray(liveItems);
  ```
  to:
  ```
  const isLive = Array.isArray(liveItems) && liveItems.length > 0;
  ```
- Also enable the cache query when live is empty (currently it passes `undefined` to `useSapMasterData` whenever liveItems is an array). Pass `masterType` unconditionally so cached rows are always available as a fallback source:
  ```
  const { data: cachedRows, isLoading } = useSapMasterData(masterType);
  ```
  and select `raw` from `liveItems` when `isLive` is true, otherwise from `cachedRows`.

## Effect

- SAP Sync popup: Vendor Cash Flow shows the 36 cached CFSTMT options, Tier Category shows the 3 cached CP_TIER options — even while the Classification F4s middleware secret is being fixed.
- International vendor form's Country (245) and Region (1583) dropdowns hydrate from cache the same way (they use `useEnsureSapMaster` directly, which is already fine — this fix additionally ensures any SapF4 fields wired with an empty liveItems array still populate).
- No changes to the edge function, payload builder, migrations, or storage. Data already stores correctly (verified: `sap_master_data` has all master types populated).

## Out of scope

- Middleware 401 for Classification F4s (`MIDDLEWARE_SHARED_SECRET` must match Proxy Secret on the host — infra fix, not code).
- Adding Country/Region to the Domestic vendor form (per your answer: International only).
