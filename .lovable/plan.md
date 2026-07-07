## Goal
Apply the new sidebar and app-shell spec (dark teal sidebar #16262D with #233A46 selected state, #23C4B5 accent, layout metrics) as design tokens so every component picks them up without touching component logic.

## Files to change

### 1. `src/index.css`
Update sidebar tokens in `:root` (and mirror in `.dark`) to match the exact hex values:
- `--sidebar-background` → `196 35% 13%` (#16262D)
- `--sidebar-foreground` → `200 20% 87%` (#D5E0E5, normal menu text)
- `--sidebar-accent` (selected/hover surface) → `202 33% 20%` (#233A46)
- `--sidebar-accent-foreground` → `0 0% 100%` (#FFFFFF)
- `--sidebar-border` → `200 28% 20%` (#243841)
- `--sidebar-primary` → `174 70% 45%` (#23C4B5 badge/accent)
- `--sidebar-primary-foreground` → `0 0% 100%`
- `--sidebar-ring` → `174 70% 45%`
- Add helper token `--sidebar-hover: 202 34% 18%` (#1D323D) and `--sidebar-submuted: 202 16% 70%` (#A8B7BF) for submenu text.

Keep light-slate app background: confirm `--background 210 20% 97%` (#f4f6f9) and `--card 0 0% 100%`.

### 2. `tailwind.config.ts`
Extend the existing `sidebar` color map with:
- `hover: "hsl(var(--sidebar-hover))"`
- `submuted: "hsl(var(--sidebar-submuted))"`

No other color additions needed — components already read `bg-sidebar`, `bg-sidebar-accent`, etc.

### 3. `src/components/layout/Sidebar.tsx`
Small class-level adjustments so the spec renders correctly (no logic changes):
- Root `<aside>`: keep `w-64` when expanded (already the case) and swap the top-level bg to `bg-sidebar text-sidebar-foreground`.
- Logo header row: give it `h-16 bg-card` (white) with `border-b border-sidebar-border` per spec.
- Nav item base classes → `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium`.
  - Active: `bg-sidebar-accent text-sidebar-accent-foreground shadow-sm`
  - Hover (inactive): `hover:bg-sidebar-hover`
- Any sub-item rendering (SAP children, if present in nav): `px-3 py-1.5 text-xs text-sidebar-submuted border-l border-sidebar-border ml-4 pl-3`.

### 4. `src/components/layout/AppLayout.tsx` + `EnterpriseHeader.tsx`
- Main wrapper stays `min-h-screen bg-background`.
- Ensure the top header uses `h-16 sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b px-4 lg:px-8` (EnterpriseHeader).
- `<main>` content padding → `px-4 py-6 lg:px-8 lg:py-8 animate-fade-in` (replaces current `p-6`).

## Out of scope
- No changes to routing, permissions, business logic, or the SAP sync work.
- No new Tailwind utilities beyond the two sidebar color aliases.
- Brand-orange runtime override (`useThemeColor`) continues to win for `--primary` — sidebar tokens are independent so it will not clash.

## Verification
After build, load `/dashboard` at desktop width and confirm:
- Sidebar bg is dark teal, active item is lighter teal pill with white text, hover is subtle, divider visible.
- Top header is white/blurred, main content has the new padding, fade-in animation plays on route change.
