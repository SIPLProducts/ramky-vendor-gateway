Plan: Hide Draft Applications Dashboard Tile

1. Goal
   - Remove the "Draft Applications" summary tile from the Dashboard so it is no longer visible, while keeping the rest of the dashboard tiles (Total, Pending, Approved, Rejected) intact.

2. Current state
   - `src/pages/Dashboard.tsx` renders a 5-column grid of tiles including Draft, Total, Pending, Approved, and Rejected.
   - The Draft tile uses a slate/gray color scheme and toggles the `statusFilter` to `'draft'` when clicked.
   - Counts and filters are computed for Draft alongside the other statuses.

3. Changes
   - In `src/pages/Dashboard.tsx`:
     - Remove the Draft tile from the `cards` array.
     - Update the grid layout from `lg:grid-cols-5` to `lg:grid-cols-4` so the remaining four tiles fit evenly.
     - Remove the `'draft'` branch from `statusFilter` logic (since there will be no UI entry to select it) so the filter can only be one of `all`, `pending`, `approved`, or `rejected`.
     - Remove the `draft` counter from `counts`.
     - Keep the underlying vendor data query unchanged; draft vendors will still be included in the "Total" count but not surfaced as a separate tile.

4. Out of scope
   - No backend or database changes.
   - No changes to draft status handling elsewhere in the app (e.g., All Vendors screen, vendor registration).