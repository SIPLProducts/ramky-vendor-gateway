## Problem

When admins click **Edit** on a built-in field in the Form Builder, the same usage/importance information shows up twice:

1. **Above** — on the field row itself, behind the ⓘ (Info) icon popover (added earlier).
2. **Below** — inside the inline editor as a large blue "Usage / Why it matters" panel (added more recently).

The two surfaces show identical copy from `getBuiltInFieldInfo()`, so the editor view feels cluttered and repetitive. The user wants the duplicate gone — keep it in **one place only**.

## Decision

Keep the ⓘ popover on the row (it's compact, always reachable, doesn't take vertical space) and remove the large duplicate info panel from inside the inline editor. Replace it with a slim one-line reminder so admins still know it's a locked built-in field and where to read its purpose.

## UX after the change

Editing a built-in field will look like:

```text
┌──────────────────────────────────────────────────┐
│ ⓘ  Editing built-in field "Registered: State"     │
│    field key & type are locked. Click the ⓘ on    │
│    the row above to see usage & why it matters.   │
├──────────────────────────────────────────────────┤
│ Display Label *        Field Key (locked)         │
│ [ ............... ]    [ registeredState ]        │
│ Type (locked)  Placeholder       Order            │
│ ...                                               │
└──────────────────────────────────────────────────┘
```

- No more big duplicated Usage / Why-it-matters / amber warning block in the editor.
- The amber verification warning still lives in the row's ⓘ popover for locked fields, so nothing is lost.
- Custom-field editor is unaffected (it never had the panel).

## Technical Changes

**`src/components/admin/InlineFieldEditor.tsx`**
- Remove the entire `builtInMode && (() => { ... })()` block (lines 162–216) that renders the rich info card with `getBuiltInFieldInfo`, the importance bullets, and the amber `ShieldAlert`.
- Replace it with a single compact strip when `builtInMode` is true: `Info` icon + text "Editing built-in field — field key & type are locked. See the ⓘ on the row above for usage details."
- Drop the now-unused imports (`getBuiltInFieldInfo`, `ShieldAlert`) and the `locked` / `group` reads (`builtInDefaults?.locked`, `builtInDefaults?.group`) inside the editor.
- Keep the `builtInDefaults` prop shape unchanged to avoid touching the parent — `locked` and `group` simply become unused.

**No changes** to `FormBuilder.tsx`, `builtInFieldInfo.ts`, hooks, DB, or the row-level popover.

## Out of Scope

- The ⓘ popover on each built-in field row stays exactly as is (single source of truth for the documentation).
- No content edits to `builtInFieldInfo.ts`.