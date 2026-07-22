## Dashboard date filter improvements

Update the From/To date inputs in `src/pages/Dashboard.tsx`:

1. **Replace native `<input type="date">` with shadcn Popover + Calendar date pickers** for both From and To (no manual keyboard entry — selection only via calendar).
2. **Remove the "Clear" button** entirely.
3. **From date constraints:**
   - Cannot select any future date (disable dates after today).
   - Cannot select a date greater than the current To date (disable dates after `dateTo`).
4. **To date constraints:**
   - Cannot select a date earlier than the current From date (disable dates before `dateFrom`).
   - Also disable future dates (consistent — no future data exists).
5. Keep existing state (`dateFrom`, `dateTo`), query behavior, and default range (last 30 days) unchanged.
6. Display format in trigger buttons: `dd-MM-yyyy` (matches app-wide standard via `formatDate`).

### Technical notes
- Use `Popover` + `Calendar` (shadcn) with `mode="single"`, `selected`, `onSelect`, and `disabled` prop (function form) to enforce constraints.
- Add `pointer-events-auto` on Calendar wrapper per shadcn datepicker convention.
- Trigger: `Button variant="outline"` with `CalendarIcon` + formatted date, styled to match current 9-height inputs (~w-[160px]).
- No changes to query logic, tenant filters, export, or table rendering.
