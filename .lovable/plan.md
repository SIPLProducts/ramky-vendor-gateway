## Fix tenant list alignment & scrolling

**Problem:** In the Create User dialog, the "Select All" row uses `sticky top-0` inside the same scroll container as the tenant checkboxes. As the user scrolls, tenant items render *over* the sticky row (z-index / background bleed from `space-y-2` gaps), causing the overlap visible in the screenshot. The scroll area is also cramped (`max-h-40` ≈ 160px) for 159 tenants.

**Fix (frontend only — `src/components/admin/CreateUserDialog.tsx`, lines ~223–261):**

1. **Split into two containers** instead of one:
   - Outer wrapper: `border rounded-md` (keeps the framed look).
   - **Header row** (Select All) rendered *outside* the scroll area, with `px-3 py-2 border-b bg-muted/30` — no longer sticky, always visible, full-width, properly aligned.
   - **Scrollable list** below it: `max-h-64 overflow-y-auto p-3 space-y-2` — taller (256px) for better usability, with its own padding so items don't touch edges.

2. **Header alignment polish:**
   - Use `flex items-center gap-2` with the count pushed right via `ml-auto`.
   - Add subtle background (`bg-muted/30`) so it reads as a header band.
   - Remove `sticky top-0` (no longer needed — it's outside the scroller).

3. **List item alignment:**
   - Keep `flex items-center gap-2` on each row.
   - Add `pr-2` to the scroll container so the scrollbar doesn't overlap text.

4. **Loading / empty / error states** keep rendering inside the scroll container (centered, padded) — unchanged behavior, just inside the new structure.

No logic, state, or backend changes. Pure layout restructure of the tenants section.
