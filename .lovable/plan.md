
## Goal
Extend the UI Design Settings so admins can control (1) hover text + border color for buttons, and (2) font size + font weight for each distinct surface — with clear separation between Buttons (global defaults) and Action Buttons (per-label overrides).

## Buttons vs Actions (clarified)
- **Buttons card** = global default styling applied to every button in the app.
- **Action Buttons card** = per-action overrides (Approve, Reject, Save, Export, …). When an action override is set, it wins over the global default; otherwise the button inherits the global Buttons style.

## 1. Hover — add text + border color
Add two new fields to both the global Buttons style and every per-Action Button style:
- `hoverText` (color)
- `hoverBorder` (color)

Behavior: on `:hover`, background, text color, and border color all switch to the configured hover values. Defaults: `hoverText` = current text color, `hoverBorder` = current hover background (keeps today's look).

Wiring:
- `designTokens.ts` — add `hoverText`, `hoverBorder` to `ActionButtonStyle` and to `buttons` block. Emit CSS vars `--btn-hover-text`, `--btn-hover-border`, and per-action `--btn-{key}-hover-text`, `--btn-{key}-hover-border`.
- `index.css` — update global button hover and per-action `[data-action="…"]:hover` rules to apply the new vars.
- `DesignSettingsPanel.tsx` — add two ColorInput fields in the global Buttons card and in the per-action Dialog.

## 2. Typography — per-section size + weight
Add independent Font Size + Font Weight controls (and keep existing color/letter-spacing where present) for:

| Section | New controls | CSS vars |
|---|---|---|
| Sidebar menu text | size, weight | `--sidebar-font-size`, `--sidebar-font-weight` |
| Screen name (page title) | size, weight | already have `--screen-name-size`, `--screen-name-weight` — surface both in a dedicated "Screen Name" sub-card |
| Card header | size, weight | `--card-header-size`, `--card-header-weight` |
| Card body | size, weight | `--card-body-size`, `--card-body-weight` |
| Table header | size, weight | `--table-header-size`, `--table-header-weight` |
| Table body | size, weight | `--table-body-size`, `--table-body-weight` (replaces single `--table-font-size`) |

Panel reorganization inside the Design Settings tab:
- **Typography** card keeps only base body defaults (family, base size, weight, color, line-height, letter-spacing).
- **Screen Name** section (inside Typography or as its own small card) exposes screen-name size + weight + letter-spacing.
- **Sidebar** card gains size + weight rows.
- **Cards** card splits into "Header" and "Body" rows, each with size + weight (plus existing background/border/radius/shadow).
- **Tables** card splits into "Header" and "Body" rows, each with size + weight (plus existing colors/border).

## 3. Apply to the app
- `Sidebar.tsx` — sidebar menu items use `text-[length:var(--sidebar-font-size)] font-[var(--sidebar-font-weight)]`.
- `PageHeader.tsx` / `EnterpriseHeader.tsx` — screen name uses the screen-name vars (already partially wired; confirm).
- `ui/card.tsx` — CardTitle uses `--card-header-size/weight`; CardContent uses `--card-body-size/weight`.
- `ui/table.tsx` — TableHead uses `--table-header-size/weight`; TableCell uses `--table-body-size/weight`.

No business-logic files touched. No route or DB schema changes. Existing `portal_config.ui_design_settings` JSON schema gains new optional keys; defaults preserve today's appearance so nothing regresses on first load.

## Files to edit
- `src/lib/designTokens.ts` — extend `DesignSettings` type, defaults, and `applyDesignSettings` var emission.
- `src/index.css` — new var-consuming rules for hover text/border and per-section typography.
- `src/components/admin/DesignSettingsPanel.tsx` — new controls, panel reorg, per-action Dialog gains hover text/border.
- `src/components/layout/Sidebar.tsx` — consume sidebar font vars.
- `src/components/ui/card.tsx` — consume card header/body font vars.
- `src/components/ui/table.tsx` — consume table header/body font vars.
- (verify) `src/components/layout/PageHeader.tsx` uses screen-name vars.

## Out of scope
Any change to button click handlers, approval flow, data fetching, RLS, or backend config.
