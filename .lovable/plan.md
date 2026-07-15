## Goal

Extend UI Design Settings so an admin can globally control:

1. **Typography** (global fallback for everything text-related)
2. **Screen container** (page-level padding + margin, screen header size/weight)
3. **Cards** (header + body + spacing + border), everywhere `<Card>` is used

All controls live in `Settings → UI Design` and apply instantly on save via CSS variables — no per-page code changes.

---

## New / expanded config groups

### 1. Typography (global)
Already has font family / weight / letter spacing / screen name size + weight. Nothing new needed here — it's already the global fallback. We'll just re-label the section as **"Typography (Global)"** so its scope is obvious.

### 2. Screen (new group)
New `screen` block in `DesignSettings`:

- `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`  (default `24px`)
- `marginTop`, `marginRight`, `marginBottom`, `marginLeft`  (default `0`)
- `headerFontSize` (mirrors `typography.screenNameFontSize` but scoped to page `<h1>`)
- `headerFontWeight`
- `headerColor`
- `headerMarginBottom` (default `16px`)

Applied by:
- CSS vars: `--screen-pad-t/r/b/l`, `--screen-mar-t/r/b/l`, `--screen-title-*`.
- A `.app-screen` wrapper class on the main content area in `AppLayout.tsx` reads padding/margin from those vars.
- The `.screen-title` utility (already planned) reads the header vars.

### 3. Cards (extended)
Existing `cards` group gains:

- `headerBackground` (default `transparent`)
- `headerTextColor` (renames current `header`; keep back-compat)
- `bodyTextColor`
- `borderColor` (already exists as `border`, rename label to "Card Border Color")
- `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft` (body padding, default `24px`)
- `headerPaddingTop`, `headerPaddingRight`, `headerPaddingBottom`, `headerPaddingLeft` (default `24px 24px 0`)
- `marginTop`, `marginRight`, `marginBottom`, `marginLeft` (default `0 0 16px 0`)

Applied by extending `applyDesignSettings` to write:
- `--card-header-bg`, `--card-header-color`, `--card-body-color`
- `--card-pad-t/r/b/l`, `--card-header-pad-t/r/b/l`, `--card-mar-t/r/b/l`

And by patching `src/components/ui/card.tsx` (shadcn wrapper) so `<Card>`, `<CardHeader>`, `<CardContent>` read those vars (padding/margin/colors) with `!important` where the token must win over local Tailwind overrides like `pb-3` or `text-base`.

---

## Files to touch

1. `src/lib/designTokens.ts`
   - Extend `DesignSettings` interface with `screen` group and new `cards` fields.
   - Extend `DEFAULT_DESIGN_SETTINGS` with sane defaults.
   - Extend `applyDesignSettings` to emit all new CSS vars.
   - Extend `resetAppliedDesign` cleanup list.

2. `src/index.css`
   - Add `.app-screen` utility reading `--screen-pad-*` / `--screen-mar-*`.
   - Add `.screen-title` utility reading `--screen-title-*`.
   - Add card overrides that force `--card-*` vars onto `[data-slot=card]`, `CardHeader`, `CardContent` with `!important`.

3. `src/components/ui/card.tsx`
   - Add inline style bridges so padding/margin/colors from tokens win over any local classNames.

4. `src/components/layout/AppLayout.tsx`
   - Add `app-screen` class to the main content wrapper so screen padding/margin tokens apply.

5. `src/components/admin/DesignSettingsPanel.tsx`
   - Rename "Typography" section to "Typography (Global)".
   - Add new **"Screen (Page Container)"** SectionCard with icon `LayoutGrid`: 4 padding inputs, 4 margin inputs, header size/weight/color/margin-bottom.
   - Extend **Cards** SectionCard with: header background color, body text color, 4 header-padding inputs, 4 body-padding inputs, 4 margin inputs.

No schema changes — `portal_config.ui_design_settings` already stores this as JSON, so existing rows keep working (missing keys fall back to defaults).

## Out of scope

- No sweep of page-level `<h1>` tags in this pass (kept separate); the new screen tokens still apply via `.app-screen` wrapper globally.
- No changes to per-action buttons, forms, tables, sidebar.
- No DB migrations.
