# Fix: Active step missing in Application Progress tracker

## Root cause

The success screen on the vendor portal renders `RegistrationStatusTracker` with the vendor's current `status` from the database. For the vendor visible in the screenshot (ref `9FAE632C`), the DB status is **`dms_synced`** — a value that was added later for the DMS→SAP hand-off stage but was never added to the tracker's `getActiveStepIndex` switch.

Because `dms_synced` (and its sibling `dms_sync_pending`) aren't listed, the switch falls through to `default → return 0`. With active index 0:

- Step 0 (Submitted) → rendered as "Completed" (because status is not `draft`)
- All later steps → rendered as "pending" with no pulsing/active indicator
- The connector line shows 0% fill

That is exactly what the screenshot shows — Submitted is complete, but nothing afterwards lights up.

## Fix (single file, presentation only)

Edit `src/components/vendor/RegistrationStatusTracker.tsx`:

1. Add `'dms_sync_pending'` and `'dms_synced'` to the `RegistrationStatus` union type.
2. Add cases for both in `getActiveStepIndex` that return `6` (the SAP Sync step) — matching how `pending_sap_sync` is already handled, since by the time a vendor reaches DMS sync it is awaiting the final SAP vendor-code creation.

No other component, hook, edge function, DB column, or workflow logic is touched. The rest of the app already understands these statuses; only the tracker was missing the mapping.

## Validation

Reload `/register` (or the success screen) for the vendor with status `dms_synced`:

- The "SAP Sync" step pulses blue with the "In Progress" label.
- The progress connector fills up to the SAP Sync node.
- All earlier steps display as "Completed".

No regression risk for other statuses — only two unhandled enum values are being added to the switch.
