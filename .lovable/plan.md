## Dashboard Date Filter Enhancements

Replace the native `<input type="date">` From/To fields on the Dashboard header with shadcn Popover + Calendar date pickers, and enforce range validation.

### Changes (all in `src/pages/Dashboard.tsx`)

1. **Replace inputs with Date Pickers**
   - Swap both `<Input type="date">` fields for `Popover` + `Button` trigger + `Calendar` (mode="single"), matching the shadcn datepicker pattern (with `pointer-events-auto`).
   - Trigger button shows formatted date (`dd-MM-yyyy` via existing `formatDate` helper) or a placeholder ("Pick a date").
   - No text input — selection only via calendar.

2. **Remove Clear button**
   - Delete the "Clear" button and its handler.

3. **From Date constraints (via Calendar `disabled` prop)**
   - Disable dates after today (no future dates).
   - Disable dates after the currently selected To Date.

4. **To Date constraints (via Calendar `disabled` prop)**
   - Disable dates before the currently selected From Date.
   - (No future restriction on To unless requested — keeping as-is.)

5. **Selection behavior**
   - On From select: set `dateFrom` via `startOfDay`; leave To alone (already guarded by disabled dates).
   - On To select: set `dateTo` via `endOfDay`.
   - Close the popover on selection.

### Technical Notes
- Reuse existing imports: `Popover/PopoverTrigger/PopoverContent`, `Calendar`, `Button`, `CalendarIcon` from lucide-react, `format` from date-fns, `cn` from `@/lib/utils`.
- Keep existing `dateFrom`/`dateTo` state, `fromIso`/`toIso` derivation, and query keys unchanged — only the input UI and setters change.
- Defaults remain: From = today − 30 days, To = today.
