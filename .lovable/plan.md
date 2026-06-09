
## Goal

Refresh the visual identity with two brand colors — **#e87717 (orange)** and **#00a13a (green)** — and polish the sidebar scrollbar so it stays out of the way until needed.

All color changes will be done through the semantic design tokens in `src/index.css` and `tailwind.config.ts` so the entire app updates consistently (no hardcoded colors sprinkled into components).

---

## 1. Color system update (`src/index.css`)

Replace the current SAP-blue primary / teal accent with the new brand pair. Both colors converted to HSL for the token system:

- `#e87717` → `hsl(24, 82%, 50%)` — used as **primary** (buttons, active states, links, focus rings, sidebar active item, headers)
- `#00a13a` → `hsl(137, 100%, 32%)` — used as **accent** + remapped **success** (status pills, confirmation states, secondary CTAs, highlights)

Tokens updated in `:root` and `.dark`:

| Token | New value | Where it shows up |
|---|---|---|
| `--primary` | orange | Buttons, links, focus ring, active nav item |
| `--ring` | orange | Input focus outline |
| `--accent` | green | Highlights, badges, hover accents |
| `--success` | green | Success toasts, verified/approved badges |
| `--sidebar-primary` | orange | Active sidebar item background |
| `--sidebar-ring` | orange | Sidebar focus outline |
| Gradient helper `--gradient-brand` | orange → green | Optional for hero/header accents |

Dark mode gets slightly brighter variants of the same hues for contrast.

No component-level color classes will be rewritten — because the codebase already uses semantic tokens (`bg-primary`, `text-primary-foreground`, `bg-success`, etc.), buttons, cards, headers, sidebar, badges, and form controls will all pick up the new palette automatically.

## 2. Tailwind config (`tailwind.config.ts`)

No structural changes needed — the existing `primary`, `accent`, `success`, `sidebar.*` color mappings already read from the CSS variables we're updating. Will only add a `brand` color group exposing the two hex values directly for any future explicit use:

```ts
brand: {
  orange: "hsl(24 82% 50%)",
  green:  "hsl(137 100% 32%)",
}
```

## 3. Sidebar scrollbar (`src/components/layout/Sidebar.tsx` + `src/index.css`)

Currently the `<nav>` uses `overflow-y-auto` which shows the default browser scrollbar at all times.

Changes:
- Add a new utility class `.sidebar-scroll` in `index.css` that:
  - Sets a thin scrollbar (`scrollbar-width: thin` for Firefox, `::-webkit-scrollbar { width: 4px }` for Chromium).
  - Uses a transparent thumb by default and a subtle white-tinted thumb only when the sidebar is hovered (`aside:hover .sidebar-scroll::-webkit-scrollbar-thumb`).
  - Track stays transparent so the thin bar visually appears only on hover.
- Apply `sidebar-scroll` to the `<nav>` element inside `Sidebar.tsx` alongside the existing classes.

No behavioral changes — scrolling still works the same; the bar just hides until hover.

## 4. Quick visual QA

After the edits, open the preview and verify:
- Login screen "Sign In" button is orange.
- Sidebar active item uses orange background.
- Success badges / approved states use the new green.
- Sidebar scrollbar is invisible at rest and shows as a thin bar on hover.

---

## Files touched

- `src/index.css` — update CSS variables (light + dark), add `.sidebar-scroll` utility.
- `tailwind.config.ts` — add optional `brand` color group.
- `src/components/layout/Sidebar.tsx` — add `sidebar-scroll` class to the nav element.

No component logic, routes, edge functions, or database changes.
