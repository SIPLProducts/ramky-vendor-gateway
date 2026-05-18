## Problem

In `MultipleSapSyncDialog`, the toast "Refreshed from SAP — 428 values updated" fires (fetch succeeded), but the dialog body keeps showing the "Calling SAP Fields F4 API…" spinner instead of revealing the form.

## Root cause

The `useEffect` that drives the F4 fetch has `[open, vendors]` as its dependency array. `vendors` is an array prop built fresh on every parent render (`SAPSync.tsx` filters/maps selected vendors inline), so its reference changes constantly. Each parent re-render re-runs the effect, which:

1. Resets `f4Status` back to `{ state: 'loading', ... }`
2. Resets `liveF4` to `null`
3. Kicks off a new `refreshMaster.mutateAsync` call

Because the parent re-renders (e.g. from the toast, react-query cache invalidation after the first refresh succeeds, etc.) faster than the next fetch resolves, the UI is permanently pinned to the loading state even though previous fetches succeeded.

The `onSuccess` of `useRefreshSapMaster` calls `qc.invalidateQueries({ queryKey: ["sap_master_data"] })` and `refetchQueries`, which causes parent re-renders → new `vendors` reference → effect re-runs → loading again. Infinite loop of "loading".

## Fix

In `src/components/sap/MultipleSapSyncDialog.tsx`:

1. Change the effect dependency from `[open, vendors]` to `[open]` only. We only want to (re)initialize when the dialog opens, not on every parent re-render.
2. Read the tenant id from `vendors` inside the effect via a ref or by reading `vendors[0]` at effect time — but do NOT include `vendors` in deps. Since the dialog is opened with a fixed selection, the vendor list for one open cycle is stable enough; capturing it on open is correct behavior.
3. Guard against the spinner re-appearing: only set `f4Status` to `loading` if it's currently `idle` or the dialog just transitioned from closed → open (handled naturally by `[open]` deps).

That's the only change. No edge-function, no schema, no other component touched.

## Files

- `src/components/sap/MultipleSapSyncDialog.tsx` — change `useEffect` deps from `[open, vendors]` to `[open]`. Add an eslint-disable comment for the missing `vendors` dep (intentional).

## Out of scope

- Bulk sync edge function, payload builder, single-vendor `SapFieldsDialog`, design tokens.
