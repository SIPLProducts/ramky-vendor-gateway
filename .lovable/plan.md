Make the active dashboard KPI card use the same 1px green border treatment as the active sidebar item.

### Change

**File: `src/pages/Dashboard.tsx`**

Update the active state on the clickable KPI cards:

- Current: `ring-2 ring-primary border-primary` (creates a 2px focus ring look).
- Target: `bg-primary/15 text-primary border border-primary/40` to match the selected sidebar item style — 1px green border with a light green tinted background.
- Keep the light hover shadow and cursor behavior unchanged.
- Do not touch business logic, data fetching, filtering, the vendor table, or the vendor registration form.

### Visual result

Selected dashboard card will look like the selected sidebar item: a soft green pill/cell with a 1px green border, green text/icon, and a light green background fill. No functional changes.