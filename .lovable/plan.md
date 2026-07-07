## Apply new dark-teal design system

Replace the current SAP-orange/blue token set in `src/index.css` with the teal palette provided, add the new gradient/shadow/motion tokens, and wire the Tailwind aliases so components can consume them.

### Scope
Presentation only. No component logic, no backend changes.

### Files to change

**1. `src/index.css`**
- `:root` — overwrite tokens:
  - Sidebar: `--sidebar-background 200 35% 12%`, `--sidebar-foreground 180 12% 75%`, `--sidebar-primary 174 65% 42%`, `--sidebar-primary-foreground 0 0% 100%`, `--sidebar-accent 200 35% 18%`, `--sidebar-accent-foreground 0 0% 100%`, `--sidebar-border 200 30% 20%`, `--sidebar-ring 174 65% 42%`.
  - Light theme surfaces kept but tuned toward teal: `--primary 174 65% 42%`, `--ring 174 65% 42%`, `--accent 174 60% 45%` (light-mode accent).
- `.dark` — overwrite:
  - `--background 200 35% 6%`, `--foreground 180 12% 92%`
  - `--card 200 35% 9%`, `--card-foreground 180 12% 92%`, `--popover` same as card
  - `--primary 174 65% 48%`, `--primary-foreground 0 0% 100%`
  - `--accent 199 89% 55%`, `--accent-foreground 0 0% 100%`
  - `--border 222 35% 16%`, `--input 222 35% 16%`, `--ring 174 65% 48%`
  - Sidebar tokens matched to spec.
- Add gradient tokens:
  - `--gradient-primary`, `--gradient-accent`, `--gradient-surface`, `--gradient-success` per spec.
- Add shadow tokens:
  - `--shadow-sm/md/lg/card` (layered slate/foreground alphas), `--shadow-glow: 0 0 0 4px hsl(217 91% 35% / 0.12)`.
- Add motion tokens:
  - `--transition-base: 0.2s cubic-bezier(0.4,0,0.2,1)`, `--transition-smooth: 0.3s cubic-bezier(0.4,0,0.2,1)`.

**2. `tailwind.config.ts`**
- Extend `boxShadow` with `card`, `elegant`, `elevated`, `glow` mapped to the new CSS vars.
- Extend `backgroundImage` with `gradient-primary`, `gradient-accent`, `gradient-surface`, `gradient-success`.
- Extend `keyframes` + `animation`:
  - `fade-in` (0.3s), `slide-in` (0.25s), `shimmer` (2s linear infinite).
- Extend `transitionTimingFunction`/`transitionDuration` if needed to expose `transition-base`/`transition-smooth` as utilities.

### Notes / trade-offs
- Brand palette (`useThemeColor` "Sharvi Brand" orange) will still override `--primary` at runtime if a user has that saved. I'll leave the theme picker intact — the new teal becomes the default `:root`/`.dark` baseline, but user-picked palettes continue to work.
- Login page keeps its SAP-blue override (`.login-theme`) unchanged.
- No component files touched — they already consume `hsl(var(--…))` tokens.

### Verification
- Reload preview, confirm sidebar renders dark teal with teal-green active state.
- Toggle `.dark` on `<html>` (or run in a dark viewport) to spot-check card/background/primary values match hex.
- Confirm existing shadow/gradient utilities used in components still resolve (no visual regressions on Dashboard, VendorList).
