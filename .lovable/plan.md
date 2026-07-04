## Goal
Change the Vendor_Details / Vendor_CFSTMT radio behavior in the SAP Sync dialog so switching the radio does NOT reset/clear the user's dropdown selections. Instead, keep both groups' selections intact in the UI, and only at payload-send time include the selected group's arrays while sending `[]` for the other group.

## Current behavior (to change)
`handleClassifyModeChange` in `src/components/sap/SapFieldsDialog.tsx` currently wipes `classify.CASH/TIER` (or `MGV/CATV/IDS`) from form state whenever the user toggles the radio. This means the user loses their previous picks if they switch back.

## New behavior
- Switching the radio only updates `classifyMode`. No `setForm` reset of any `classify.*` arrays.
- Both cards keep showing their previously selected values. The inactive card stays visually disabled (greyed, non-interactive) as today, but its underlying state is preserved.
- On Confirm (the button that calls `onConfirm(form)`), build a final `classify` object based on `classifyMode`:
  - `mode === 'details'` → send `MGV`, `CATV`, `LOCV`, `IDS` from form; force `CASH: []` and `TIER: []`.
  - `mode === 'cfstmt'` → send `CASH`, `TIER` from form; force `MGV: []`, `CATV: []`, `IDS: []`. (`LOCV` left as-is per user spec — only CASHFLOW/VENCATEGORY listed for cfstmt; LOCATION_VENDOR is not mentioned so keep current behavior: empty for cfstmt.)
- Result: SAP payload always contains only the active group's values; the other group is `[]`, matching the requirement, but the user's picks are not destroyed when toggling.

## Technical details
File: `src/components/sap/SapFieldsDialog.tsx`
1. Remove the array-clearing `setForm` inside `handleClassifyModeChange` — leave only `setClassifyMode(mode)`.
2. In the Confirm handler (where `onConfirm(form)` is called), compute:
   ```ts
   const finalClassify = classifyMode === 'details'
     ? { ...form.classify, CASH: [], TIER: [] }
     : { ...form.classify, MGV: [], CATV: [], IDS: [] };
   onConfirm({ ...form, classify: finalClassify });
   ```
3. Keep the existing `opacity-50 pointer-events-none` styling on the inactive card so it's clear which group is active.
4. Keep the initial-mode `useEffect` unchanged.

## Out of scope
- No backend / edge function changes.
- No changes to `MultipleSapSyncDialog` (unless you want the same treatment there — please confirm).
