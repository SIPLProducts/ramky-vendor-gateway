## Why pre-fill isn't showing on Edit

Two real bugs in the built-in field editor:

### Bug 1 — The form keeps resetting on every keystroke

In `FormBuilder.tsx` we render the editor like this:

```tsx
<InlineFieldEditor
  builtInDefaults={{ field_name: bf.field_name, display_label: bf.display_label, ... }}
  ...
/>
```

`builtInDefaults` is a **fresh object literal on every render**, so its reference changes constantly. Inside `InlineFieldEditor` the seeding effect lists `builtInDefaults` in its dependency array:

```ts
useEffect(() => { ...setForm(...) }, [field, defaultOrder, builtInMode, builtInDefaults]);
```

Result: every render the effect fires again and **overwrites whatever you typed** with the catalog defaults. Visually it looks like the field "won't edit" or "resets to blank for a flash" because React schedules the reset right after the input change.

### Bug 2 — Catalog has no placeholder / help text to seed with

`BuiltInField` only stores `field_name`, `display_label`, `field_type`, `is_mandatory`. So even when seeding works, Placeholder and Help Text fields in the editor are blank. Today the vendor form has no placeholders for most built-ins, so this isn't a regression — but the user expects to see "the current vendor field details", which means we should at least show what's in the catalog.

### Bug 3 (minor) — Override row may not exist yet

When the user clicks Edit on a built-in field that has never been overridden, no row exists in `form_field_configs` yet. We pass `field={null}` and rely on `builtInDefaults` to seed. That part is correct, but combined with Bug 1 the form looked empty.

## What I'll change

### 1. Stabilize the seeding effect

In `src/components/admin/InlineFieldEditor.tsx`, depend on **primitive** values from `builtInDefaults`, not the object reference:

```ts
useEffect(() => {
  if (field) { /* seed from existing override row */ }
  else if (builtInMode && builtInDefaults) { /* seed from catalog */ }
  else { /* blank for new custom field */ }
}, [
  field?.id,
  defaultOrder,
  builtInMode,
  builtInDefaults?.field_name,
  builtInDefaults?.display_label,
  builtInDefaults?.field_type,
  builtInDefaults?.is_mandatory,
  builtInDefaults?.placeholder,
  builtInDefaults?.help_text,
]);
```

This way the effect only fires when the field actually changes, not on every render. Typing into the editor stays put.

### 2. Pass placeholder + help_text through

- Extend `BuiltInField` in `src/lib/builtInFields.ts` with optional `placeholder` and `help_text`.
- Add sensible placeholders/help text for the most common built-ins (GSTIN: "22AAAAA0000A1Z5", PAN: "ABCDE1234F", IFSC: "SBIN0001234", etc.) so the Edit dialog isn't empty.
- Extend `builtInDefaults` in `FormBuilder.tsx` to forward those fields.
- Extend the `else if` seeding branch in `InlineFieldEditor.tsx` so Placeholder / Help Text auto-fill from the catalog (and from the existing override row when one exists).

### 3. Auto-show the Advanced section when there's content

If `help_text` or `validation_regex` is non-empty when the editor opens, default `showAdvanced` to `true` so the user sees those fields immediately instead of having to click "Show advanced".

### 4. Tiny UX polish

- Add a small caption inside the inline editor when in `builtInMode`:
  > "Editing built-in field — `field_name` and type are locked. Save will store an override for this tenant."
- Save button copy becomes "Save Override" in built-in mode so it's clear what's being persisted.

## Files touched

- `src/components/admin/InlineFieldEditor.tsx` — stable effect deps, seed placeholder/help_text, default-open advanced section, built-in caption.
- `src/lib/builtInFields.ts` — add optional `placeholder` / `help_text` to `BuiltInField` and seed them for the high-traffic fields (GSTIN, PAN, Udyam, bank fields, addresses).
- `src/pages/FormBuilder.tsx` — forward `placeholder` and `help_text` from the catalog into `builtInDefaults`.

## Out of scope

- Reading the live placeholder strings from each step component at runtime (would require refactoring vendor step components). Catalog entries are sufficient for now.

Approve and I'll implement.