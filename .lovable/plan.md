# Improve Typography Clarity — Add Letter Spacing Controls

Times New Roman is loading, but at the current sizing the text feels tight/cramped. Add explicit letter-spacing (tracking) controls to the Design Settings so admins can loosen the text globally and per-surface, plus a couple of readability defaults that make serif fonts look cleaner.

## Changes

### 1. `src/lib/designTokens.ts`
Extend `DesignSettings` with new fields (all optional-safe via defaults):
- `typography.letterSpacing` (e.g. `normal`, `0.01em`, `0.02em`, `0.5px`) → `--letter-spacing`
- `typography.headingLetterSpacing` → `--heading-letter-spacing`
- `tables.letterSpacing` → `--table-letter-spacing`
- `buttons.letterSpacing` → `--btn-letter-spacing`
- `forms.inputLetterSpacing` → `--input-letter-spacing`
- `forms.labelLetterSpacing` → `--label-letter-spacing`

Defaults tuned for readability:
- body `0.01em`, headings `-0.01em`, buttons `0.02em`, labels `0.02em`, tables `0.01em`, inputs `0.01em`.

Apply each via `document.documentElement.style.setProperty(...)` in `applyDesignSettings`.

### 2. `src/index.css`
Bridge the new CSS variables to real elements:
```css
html, body { letter-spacing: var(--letter-spacing, normal); }
h1,h2,h3,h4,h5,h6 { letter-spacing: var(--heading-letter-spacing, normal); }
button, [role="button"], .btn { letter-spacing: var(--btn-letter-spacing, normal); }
input, textarea, select { letter-spacing: var(--input-letter-spacing, normal); }
label { letter-spacing: var(--label-letter-spacing, normal); }
table, th, td { letter-spacing: var(--table-letter-spacing, normal); }
```
Also add a global body rule:
```css
body { text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
```
so serif fonts (Times New Roman, Georgia) render crisply.

### 3. `src/components/admin/DesignSettingsPanel.tsx`
Add new inputs (using existing `TextInputField`):
- **Typography** section: `Letter Spacing`, `Heading Letter Spacing` (placeholder `0.01em`, `normal`, `0.5px`).
- **Buttons** section: `Letter Spacing`.
- **Forms** section: `Input Letter Spacing`, `Label Letter Spacing`.
- **Tables** section: `Letter Spacing`.

Each accepts any valid CSS value (`normal`, `em`, `px`, `rem`). Helper text under Typography: "Use `0.01em`–`0.03em` to make serif fonts like Times New Roman easier to read."

### 4. Migration safety
`mergeDeep` in `useDesignSettings.tsx` already merges new keys from defaults, so existing saved configs pick up the new letter-spacing defaults without a DB migration.

## Out of scope
No changes to backend, storage schema, business logic, or page-level components. Purely presentation tokens in the Design Settings tab.
