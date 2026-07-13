
# UI Design Settings Tab

Add a new **UI Design Settings** tab in Admin Configuration that lets admins control the app's visual design at runtime. Settings persist in the `portal_config` table and apply instantly by writing CSS variables to `:root`, so no code changes are needed to re-theme the app. No business logic touched.

## Scope

Purely visual/styling. Green left-border card style matching the rest of Admin Configuration. Existing functionality unchanged.

## Where it lives

- New tab in `src/pages/AdminConfiguration.tsx` beside "General / Validations / Email / Notifications / Screen / Logs", labeled **UI Design** (icon: `Palette`).
- Tab content is a new component `src/components/admin/DesignSettingsPanel.tsx`.

## Groups & fields

Each group is a green-left-border card with the fields listed:

1. **Global Theme** — Primary, Secondary, Success, Warning, Error, Background color, Page font family.
2. **Typography** — Font family, base font size, heading font size, screen-name font size, base font weight, screen-name font weight, font color, line height.
3. **Sidebar** — Background, text, active menu, hover, icon color, width (px).
4. **Buttons** — Background, text, border, border-radius, font size, hover, disabled color.
5. **Forms** — Input font size, input text color, placeholder color, border color, border-radius, focus border color, label font size, label color.
6. **Tables** — Header bg, header text, row text, alternate row, border color, font size.
7. **Cards** — Background, header color, border color, border-radius, shadow (preset: none / sm / md / lg).

All colors use a color picker + hex input. Sizes use number inputs with `px` / `rem` where appropriate. Font family uses a select (Inter, Roboto, Poppins, Open Sans, System) + custom text.

## Actions

- **Preview** — writes CSS vars live to `:root` while editing (no save).
- **Save Changes** — persists to `portal_config` under key `ui_design_settings`.
- **Reset to Defaults** — restores built-in tokens (removes overrides).

## Runtime application

- New hook `src/hooks/useDesignSettings.tsx`:
  - Loads `portal_config.ui_design_settings` on app mount.
  - Applies values by setting CSS custom properties on `document.documentElement`:
    - Colors converted to HSL triplets to fit existing tokens (`--primary`, `--secondary`, `--background`, `--foreground`, `--destructive`, `--sidebar-*`, `--border`, `--input`, `--ring`, `--radius`, plus new `--btn-*`, `--table-*`, `--card-header`, `--card-shadow`, `--font-sans`, `--font-base-size`, `--heading-size`, `--screen-name-size`, `--font-weight-base`, `--screen-name-weight`, `--line-height-base`, `--sidebar-width`).
  - Realtime subscription on `portal_config` so a Save from any admin propagates to open sessions.
- Provider mounted in `src/main.tsx` next to `ThemeColorProvider` (order: DesignSettingsProvider inside ThemeColorProvider so brand palette still initializes first, design overrides applied after).
- `src/index.css` gains a few new CSS variables (`--btn-*`, `--table-*`, `--card-header`, `--card-shadow`, `--font-sans`, `--font-base-size`, `--heading-size`, `--screen-name-size`, `--line-height-base`, `--sidebar-width`) with sensible defaults, and body/heading/sidebar rules read from them. Existing hardcoded values remain as fallback so nothing breaks if the design row is empty.

## Persistence

- Uses existing `portal_config` table (no schema change needed): one row with `config_key = 'ui_design_settings'`, `config_value = jsonb` matching the settings shape. RLS already covers admin write.

## Sidebar / component wiring

- `src/components/layout/Sidebar.tsx`: width driven by `var(--sidebar-width, 16rem)`, colors already use `--sidebar-*` tokens.
- Buttons/forms/tables/cards: extend the shadcn variants to reference the new vars via Tailwind arbitrary values in the base component classes only (no per-page changes).

## Files to add / edit

Add:
- `src/components/admin/DesignSettingsPanel.tsx` (UI + save/reset).
- `src/hooks/useDesignSettings.tsx` (load, apply, subscribe, context).
- `src/lib/designTokens.ts` (defaults, hex↔HSL helpers, CSS var mapping).

Edit:
- `src/pages/AdminConfiguration.tsx` — add tab trigger + content.
- `src/main.tsx` — wrap App with `DesignSettingsProvider`.
- `src/index.css` — declare new CSS variables with fallback defaults.
- `src/components/layout/Sidebar.tsx` — use `--sidebar-width` var.
- `tailwind.config.ts` — expose new vars where needed for `text-[hsl(var(...))]` usage.

## Out of scope

No changes to auth, vendor flows, approvals, SAP sync, or any business logic. No changes to existing tabs.

## Acceptance

- New tab visible in Admin Configuration for admins.
- Changing any control updates the preview immediately.
- Save Changes persists and all open browser tabs reflect the change on next load (or immediately via realtime).
- Reset restores defaults everywhere.
- No regression in existing screens.
