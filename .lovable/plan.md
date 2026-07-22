## Problem
Current From/To filters render as a Button that opens a Popover Calendar. User expects an input-styled field with a calendar icon (like a normal date picker) — not a button — while still preventing manual typing and enforcing range rules.

## Changes (src/pages/Dashboard.tsx only)

Replace the Button-based popover trigger with an input-styled trigger:

- Render each From/To as a read-only styled input (same look as other form inputs on the page: `h-9`, bordered, rounded, background) with:
  - The formatted date (`dd-MM-yyyy`) as its displayed value, or placeholder `Select date`.
  - A trailing calendar icon button inside the input on the right.
- Wrap the whole input in `PopoverTrigger asChild` so clicking anywhere on the field (input or icon) opens the calendar.
- Keep the input `readOnly` and add `onKeyDown={(e) => e.preventDefault()}` so nothing can be typed, pasted, or cleared via keyboard.
- Keep the existing Calendar with the same `disabled` rules already in place:
  - From: disables future dates and dates after To.
  - To: disables dates before From.
- Keep the auto-correction that shifts To when From moves past it.
- No Clear button (already removed).
- Popover closes on select (existing behavior via `setFromOpen(false)` / `setToOpen(false)` in handlers).

No other files touched. No business-logic changes.

## Acceptance
- From/To look like input fields with a calendar icon, not buttons.
- Clicking the field or the icon opens the calendar and a date can be selected.
- Typing/pasting into the field does nothing.
- Range constraints (no future From, To ≥ From) still enforced by disabled days in the calendar.
