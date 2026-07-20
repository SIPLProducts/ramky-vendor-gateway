# Contact Details — enforce 3-column layout everywhere

Not fully done. All multi-field rows in `src/components/vendor/steps/AddressStep.tsx` already use `md:grid-cols-3`, but four single-field rows sit outside any grid and render full-width, breaking the 3-column look.

## Rows to fix in `src/components/vendor/steps/AddressStep.tsx`

1. Registered Office — Address Line 1 (line 240)
2. Manufacturing — Address Line 1 (line 472)
3. Branch — Email ID (line 640)
4. Branch — Address Line 1 (line 654)

## Change

Wrap each of the four rows in a `<div className="grid md:grid-cols-3 gap-5">` so the input occupies the first of three columns (matching the row above/below). No field logic, validation, or behavior changes.

## Out of scope

- No changes to Registered/Correspondence/Manufacturing/Branch field lists or validation.
- No changes to other tabs.
