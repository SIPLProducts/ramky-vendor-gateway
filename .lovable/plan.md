# Indian Financial Year for Turnover (Last 3 Years)

## Problem
Turnover labels in the vendor registration form are derived from the calendar year (`new Date().getFullYear()`). Between January and March they show an FY that hasn't ended yet.

## Fix
Compute the **last completed Indian FY** and show it plus the two prior ones.

### Logic
```
const now = new Date();
const y = now.getFullYear();
const m = now.getMonth(); // 0 = Jan
// Current Indian FY start year: if before April, it's y-1, else y
const currentFyStart = m < 3 ? y - 1 : y;
// Last completed FY start year = currentFyStart - 1
const lastCompletedStart = currentFyStart - 1;

// Show FYs: (lastCompletedStart-2), (lastCompletedStart-1), lastCompletedStart
// Label format: `FY ${start}-${(start+1).toString().slice(-2)}`
```

### Behavior
- 02-Jul-2026 → FY 2023-24, 2024-25, 2025-26
- 15-Feb-2027 → FY 2023-24, 2024-25, 2025-26 (unchanged, correct)
- 01-Apr-2027 → FY 2024-25, 2025-26, 2026-27 (auto-rolls)

## Files to change
- `src/components/vendor/steps/FinancialInfrastructureStep.tsx` — replace the `currentYear` constant and the three `<Label>` expressions with a small `getLastThreeIndianFYs()` helper.
- `src/components/vendor/steps/FinancialStep.tsx` — apply the same helper if it renders the same labels.

## Out of scope
No changes to stored field keys (`turnoverYear1/2/3`), form schema, backend, or SAP mapping — only display labels.
