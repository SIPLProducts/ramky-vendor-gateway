## Goal
Remove the "show all options" fallback on the Rec-Account dropdown. Only show options that actually match the current filter (e.g. selected Company Code). If nothing matches, show an empty state message — never inject unrelated options.

## Changes

### 1. `src/components/sap/SapMasterCombobox.tsx`
- Remove the `allowFilterFallback` behavior that swaps in the unfiltered list when the filtered list is empty.
- Always render only the filtered `options` array.
- When the filtered list is empty, show a clear empty state inside the dropdown:
  - "No options match the current filter (Company Code: 1000)." for Rec-Account
  - "No options available." for others
- Remove the helper line "Showing all 534 options; no match for current filter." since fallback is gone.
- Keep the "X options loaded." count, but base it on the filtered list so the number reflects what the user actually sees.

### 2. `src/components/sap/SapFieldsDialog.tsx`
- Remove the `allowFilterFallback` prop being passed to the Rec-Account `SapMasterCombobox` (no longer needed).
- No other behavior changes.

## Out of scope
- No edge function changes.
- No master-data refresh logic changes.
- No filter rule changes (Rec-Account stays filtered by selected Company Code).