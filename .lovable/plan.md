
## Goal

1. Revert the **login page** to its previous **SAP blue** look (don't use the new orange brand color there).
2. Add a **color picker / theme switcher** in the top navbar so any logged-in user can switch the app's accent palette on the fly.

---

## 1. Login page: keep the old blue

The login page (`src/pages/Auth.tsx`) currently uses semantic tokens like `bg-primary`, so it inherits whatever `--primary` is set to. Since we changed `--primary` globally to orange, the login screen turned orange too.

Approach: scope a **blue override** to the login route only, instead of reverting the global tokens.

- Wrap the `Auth.tsx` root container with a class `login-theme`.
- In `src/index.css`, add a scoped block:
  ```css
  .login-theme {
    --primary: 210 100% 40%;          /* SAP blue */
    --primary-foreground: 0 0% 100%;
    --ring: 210 100% 40%;
    --accent: 187 85% 43%;            /* old teal accent */
  }
  ```
- The "Sign In" button, "Forgot password?" link, focus rings and any branded element on the login screen will go back to blue. The rest of the app keeps the new orange + green palette.

No component logic changes.

## 2. Theme color picker in the navbar

Add a small palette button to the top header so users can pick the app's accent color live.

### Files

- **New** `src/hooks/useThemeColor.tsx` — React context + provider.
  - Stores the selected palette key in `localStorage` (`portal-theme-color`).
  - Writes the corresponding HSL values to `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring`, and `--accent` on `document.documentElement`.
  - Exposes `{ current, setColor, palettes }`.

- **New** `src/components/layout/ThemeColorPicker.tsx` — popover with swatches.
  - Trigger: `Palette` icon button (lucide-react) sized to fit the header.
  - Popover content: a 4-column grid of color swatches. Selecting one calls `setColor(key)` and shows a check mark on the active swatch.
  - Built with existing shadcn `Popover` + `Button`.

- **Edit** `src/main.tsx` (or `App.tsx`) — wrap the app tree with `<ThemeColorProvider>` so the saved color is applied before first paint.

- **Edit** `src/components/layout/EnterpriseHeader.tsx` and `src/components/layout/MobileHeader.tsx` — insert `<ThemeColorPicker />` next to the existing header actions (notifications / user menu).

### Preset palettes

Each preset defines `primary` + `accent` HSL pairs:

| Key | Label | Primary | Accent |
|---|---|---|---|
| `brand` (default) | Sharvi Orange + Green | `24 82% 50%` | `137 100% 32%` |
| `blue` | Classic Blue | `210 100% 40%` | `187 85% 43%` |
| `indigo` | Indigo | `239 84% 56%` | `262 83% 58%` |
| `emerald` | Emerald | `160 84% 32%` | `173 80% 40%` |
| `rose` | Rose | `347 77% 50%` | `24 95% 53%` |
| `slate` | Slate | `215 28% 25%` | `199 89% 48%` |

(Six is a comfortable grid; final list easy to extend later.)

### Login page exception

Because the login route applies the `.login-theme` scoped overrides (Step 1), the theme picker won't affect the login screen — which is the intended behavior.

---

## Files touched

- `src/index.css` — add `.login-theme` scoped overrides.
- `src/pages/Auth.tsx` — add `login-theme` class to root container.
- `src/hooks/useThemeColor.tsx` — new provider + hook.
- `src/components/layout/ThemeColorPicker.tsx` — new swatch popover.
- `src/main.tsx` — mount `ThemeColorProvider`.
- `src/components/layout/EnterpriseHeader.tsx` — add picker to desktop header.
- `src/components/layout/MobileHeader.tsx` — add picker to mobile header.

No backend, RLS, edge function, or DB changes. Selection is per-browser (localStorage). If you'd rather persist per-user in the database, say so and I'll add that instead.
