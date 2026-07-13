## Fix: Sidebar selected state + Action Buttons layout

### 1. Sidebar selected color leaking from Global Theme

`src/components/layout/Sidebar.tsx` uses `bg-primary/15 text-primary border-primary/40` (line ~209) and `bg-primary` on the left rail (~224) for the active menu item. Those classes read `--primary` — the Global Theme color — which is why the Sidebar card's Selected Menu Background / Border / Text controls have no effect.

Rebind active/hover classes to sidebar tokens (already set from the Sidebar card via `applyDesignSettings`):

- Active item background → `bg-sidebar-accent`
- Active item text → `text-sidebar-accent-foreground`
- Active item left rail → `bg-[color:var(--sidebar-selected-border)]` (was `bg-primary`)
- Active item border → `border-[color:var(--sidebar-selected-border)]`
- Hover keeps existing `hover:bg-sidebar-hover hover:text-sidebar-accent-foreground`

Also add a strengthened rule in `src/index.css` so any other place that marks itself active with `[data-active="true"]` inside `[data-sidebar]` picks up `background: hsl(var(--sidebar-accent))` and the selected-border variable, with `!important` to beat any residual `--primary`-based utility class.

Result: Sidebar card controls fully own selected-menu appearance; Global Theme primary no longer bleeds in.

### 2. Action Buttons — grid layout with dialog editor

In `src/components/admin/DesignSettingsPanel.tsx`, replace the current full-width Accordion with a responsive tile grid:

```
grid  grid-cols-2  md:grid-cols-3  lg:grid-cols-4  xl:grid-cols-6  gap-4
```

Each tile shows:
- A rounded color swatch preview of the button (using its own bg/text/border)
- The action label (e.g. "Approve", "Export PDF")
- Small "Edit" affordance on hover

Clicking a tile opens a shadcn `<Dialog>` with the same 6 fields already implemented (Background, Text, Border, Hover, Border Radius, Font Size). Changes still call `preview(next)` for live update. Dialog closes on Save/Cancel — no persistence change; the outer "Save Changes" button still writes to the DB.

Benefit: all 22 actions visible at a glance, clear spacing, no long vertical scroll.

### Files changed

- `src/components/layout/Sidebar.tsx` — swap `*-primary*` active classes for sidebar tokens (presentation only, no route/logic change).
- `src/index.css` — add stronger `[data-sidebar] [data-active="true"]` fallback rule using sidebar variables.
- `src/components/admin/DesignSettingsPanel.tsx` — replace Accordion with tile grid + Dialog editor for action buttons.

No backend, no schema, no button behavior changes.
