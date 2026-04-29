## Goal

Surface the same **info (ⓘ) + Usage + Why-it-matters** copy inside the inline editor when an admin clicks **Edit** on a built-in field — not just on the row header. This keeps the field's purpose visible while the admin is changing labels / requirement / placeholder.

## UX

Replace the current plain blue "Editing built-in field — fieldName and type are locked…" notice at the top of the inline editor with a richer card:

```text
┌──────────────────────────────────────────────────┐
│ ⓘ  Registered: State                              │
│    registeredState • locked field key & type      │
│ ─────────────────────────────────────────────── │
│ USAGE                                             │
│ State of the registered office.                   │
│                                                   │
│ WHY IT MATTERS                                    │
│ • Determines GST place-of-supply                  │
│ • Used for state-wise vendor analytics            │
│                                                   │
│ ⚠ Hiding this disables GST verification (only     │
│   for verification-locked fields)                 │
└──────────────────────────────────────────────────┘
```

- Same `getBuiltInFieldInfo(field_name)` lookup already used by the row popover — single source of truth.
- Compact: same width as the editor card, primary-tinted background to match current "edit" highlight.
- Amber callout block only renders when the underlying built-in field is `locked` (verification-critical).
- For non-built-in (custom) fields the panel is not shown — editor behaves exactly as today.

## Technical Changes

1. **`src/components/admin/InlineFieldEditor.tsx`**
   - Import `Info` from lucide-react and `getBuiltInFieldInfo` from `@/lib/builtInFieldInfo`.
   - Extend the `builtInDefaults` prop with an optional `locked?: boolean` and `group?: string` so the editor can decide whether to render the amber verification callout (these come for free from the `BuiltInField` catalog).
   - Replace the existing one-line `builtInMode` notice (lines 159–164) with a styled info panel that renders:
     - Header: `Info` icon + display label + monospace field_name + "locked" hint
     - "Usage" section
     - "Why it matters" bulleted list
     - Conditional amber verification warning when `builtInDefaults.locked`
   - No changes to save logic, state seeding, or API contract.

2. **`src/pages/FormBuilder.tsx`**
   - When mounting `<InlineFieldEditor builtInMode … />` (around line 583) pass two extra fields into `builtInDefaults`: `locked: bf.locked` and `group: bf.group`.

3. No DB / hook / migration changes.

## Out of Scope

- Editing the usage/importance text from the UI — it stays code-managed in `builtInFieldInfo.ts`.
- Adding the panel to the custom-field editor (custom fields are admin-authored, no canned info).
