## Problem

Two issues in UI Design Settings:

1. **Times New Roman missing** from the Font Family dropdown.
2. **Table card border color (and other Table / Card tokens) not reflecting** — the settings write CSS variables (`--table-border`, `--table-header-bg`, `--card-shadow`, etc.) but the shadcn `Table` and `Card` components use hardcoded classes (`bg-muted/40`, `border-border/60`, `text-muted-foreground`), so the tokens are never consumed.

## Fix

### 1. `src/components/admin/DesignSettingsPanel.tsx`
Extend the fonts list (already planned to be ~70+ items) to include the full serif set explicitly, with **Times New Roman**, Georgia, Cambria, Garamond, Palatino, Book Antiqua, Baskerville, Courier New, Consolas, Trebuchet MS, Verdana, Tahoma, Arial, Helvetica, etc. under the System / Serif / Monospace groups. Each item previews itself in its own font.

### 2. `src/lib/googleFonts.ts` (new, from prior plan)
`ensureFontLoaded(family)` skips system fonts (Times New Roman, Georgia, Arial, Courier New, Consolas, Verdana, Tahoma, Trebuchet MS, Helvetica, System, etc.) and only injects a Google Fonts `<link>` for web fonts. Called from `applyDesignSettings` for both `theme.fontFamily` and `typography.fontFamily`, and from the Select's on-change for instant preview.

### 3. `src/index.css` — bridge tokens to real components (root fix for "not reflecting")
Add global rules so the tokens set by `applyDesignSettings` actually paint the UI. No component files edited; behaviour unchanged. Approx:

```css
/* Tables */
table thead tr, table thead th {
  background: var(--table-header-bg);
  color: var(--table-header-text);
}
table, table th, table td, table tr {
  font-size: var(--table-font-size);
  border-color: var(--table-border);
}
table tbody tr { color: var(--table-row-text); border-bottom: 1px solid var(--table-border); }
table tbody tr:nth-child(even) { background: var(--table-alt-row); }

/* Cards — border, radius, shadow, header color */
[class*="rounded-lg"][class*="border"][class*="bg-card"] {
  border-color: hsl(var(--border));
  border-radius: var(--radius);
  box-shadow: var(--card-shadow);
}
[class*="rounded-lg"][class*="border"][class*="bg-card"] :is(h1,h2,h3,[class*="CardTitle"]) {
  color: var(--card-header-color);
}

/* Buttons — bridge --btn-* onto default button variant */
button[class*="bg-primary"] {
  background: var(--btn-bg);
  color: var(--btn-text);
  border-color: var(--btn-border);
  border-radius: var(--btn-radius);
  font-size: var(--btn-font-size);
}
button[class*="bg-primary"]:hover { background: var(--btn-hover); }
button[class*="bg-primary"]:disabled { background: var(--btn-disabled); }

/* Forms */
input, textarea, select, [role="combobox"] {
  font-size: var(--input-font-size);
  color: var(--input-text);
  border-radius: var(--input-radius);
}
input::placeholder, textarea::placeholder { color: var(--input-placeholder); }
input:focus, textarea:focus, select:focus, [role="combobox"]:focus {
  border-color: var(--input-focus);
  outline-color: var(--input-focus);
}
label { font-size: var(--label-font-size); color: var(--label-color); }

/* Font family everywhere — dropdowns, tables, dialogs, popovers */
html, body, button, input, select, textarea, table, [role="menu"], [role="listbox"], [role="dialog"] {
  font-family: var(--font-sans);
}
```

### 4. `tailwind.config.ts`
```ts
fontFamily: { sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'] }
```
So every `font-sans` (which is Tailwind's default) resolves through the token.

## Out of scope
No changes to storage shape, business logic, or per-page components. Only `DesignSettingsPanel.tsx`, `googleFonts.ts` (new), `designTokens.ts`, `index.css`, `tailwind.config.ts`.
