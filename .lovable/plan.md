## Match reference styling — Dashboard, Buttons, Sidebar, Table

Pure visual polish. No logic changes.

### 1. Dashboard title & description (`src/pages/Dashboard.tsx`)
Match the reference "Operations Dashboard" typography:
- Title: `text-[32px] font-bold tracking-tight text-foreground` (was `text-[26px] font-semibold`)
- Description: `text-[15px] text-muted-foreground` with `mt-1.5`
- Keep the two-line stacked layout on the left, actions on the right.

### 2. Buttons (`src/components/ui/button.tsx`)
Reference Export button = deep emerald filled, subtle shadow, `rounded-lg`.
- `default` variant: `bg-primary text-primary-foreground rounded-lg shadow-sm hover:bg-[hsl(var(--primary-hover))]` — swap `rounded-md` for `rounded-lg` on default+outline so both match the reference pill shape.
- `outline`: `border border-border bg-card rounded-lg shadow-sm hover:bg-muted` (Refresh button style — white with soft border).
- Sizes stay `h-9 px-4`.

### 3. Sidebar selected item (`src/components/layout/Sidebar.tsx`)
Reference sidebar selection uses the same emerald as the Export button, with a matching rounded-lg pill. Currently selection is `bg-primary` but with `rounded-md`. Change to:
- Selected: `bg-primary text-primary-foreground rounded-lg shadow-sm` (was `rounded-md`)
- Base: `rounded-lg` (was `rounded-md`) so hover/selected share the same shape.
- Keep the `mx-1` inset so the pill sits inside the rail.

### 4. Dashboard table — reference # column (`src/pages/Dashboard.tsx`)
Reference shows DMR/reference numbers in a bold monospace-style font, dark foreground (not the muted primary link look we have). Update the body cell for `Reference #`:
- From: `font-mono text-xs` link in `text-primary`
- To: `font-mono text-[13px] font-semibold text-foreground hover:text-primary` — keeps clickable link behavior, matches the reference's bold DMR-NO look.

### Not touched
Vendor Registration, business logic, routes, workflows, edge functions, hooks, auth.

### Verify
Typecheck + visual check on `/dashboard`.
