

## Form Builder: Drag-and-drop reordering + inline field editor

Make the Form Builder feel like a real builder: reorder tabs by dragging them, see all existing fields per tab, and add new fields inline (no drawer pop-out).

### What changes

**1. Drag-and-drop tab reordering (left rail)**

- Tabs in the left rail become draggable using `@dnd-kit/core` + `@dnd-kit/sortable` (already common in the React stack; will be added).
- Drag handle = the existing `GripVertical` icon. Cursor changes to grab on hover.
- Built-in tabs (Doc Verify, Org, Address, Contact, Fin/Infra, Review) are **locked** — they show the lock icon and can't be dragged or reordered. Only custom tabs are reorderable, and only **between** the last built-in step (Fin/Infra, order 5) and Review (order 99).
- On drop: recompute `step_order` for all custom tabs (e.g. 6, 7, 8, …) and persist in one batched update via a new `useReorderFormSteps` mutation in `useFormBuilder.tsx`. Optimistic UI update + react-query invalidation.

**2. Drag-and-drop field reordering (right pane)**

- Same `@dnd-kit/sortable` treatment for the field rows inside the selected tab.
- Works for both built-in steps (overrides) and custom steps.
- On drop: recompute `display_order` for all fields in that step and persist via a new `useReorderFormFields` mutation. Optimistic + invalidate.

**3. Inline "Add Field" + inline edit (replaces the drawer for the common case)**

- Replace the slide-in `FieldEditorDrawer` with an **inline expandable row** at the top of the field list:
  - "+ Add Field" button expands a compact inline form (Field Key, Display Label, Type, Mandatory, Visible, Placeholder) with `[Save] [Cancel]`.
  - Advanced options (Help Text, Default Value, Validation Regex, Validation Message, Options for selects) live inside a `[Show advanced]` collapsible inside the same inline form.
- **Editing** an existing field also opens inline: clicking the row expands it in place into the same compact form. Other rows collapse.
- Only one row is in edit/add mode at a time.
- The drawer file (`FieldEditorDrawer.tsx`) is removed since everything happens inline.

**4. Existing fields list — always visible**

- Even when no tab is selected on first load, default to the first tab and render its fields.
- Each field row shows: drag handle, label, type badge, Required/Hidden badges, field key, and Edit / Delete buttons. Clicking the row (or Edit) toggles inline edit.
- Empty state stays the same but now sits below the inline "Add Field" button so the path forward is obvious.

### Files

**Edited:**
- `src/pages/FormBuilder.tsx`
  - Wrap the tabs list in `<DndContext><SortableContext>` and the fields list in another. Use `arrayMove` on drag end.
  - Replace the field editor drawer trigger with an inline `FieldRowEditor` component (defined in the same file or extracted to `src/components/admin/InlineFieldEditor.tsx`).
  - Pre-select the first available tab on mount.
- `src/hooks/useFormBuilder.tsx`
  - Add `useReorderFormSteps(tenantId)` — accepts ordered list of `{id, step_order}` and runs a Supabase upsert in a single round-trip.
  - Add `useReorderFormFields(tenantId, stepKey)` — same shape for `form_field_configs`.

**Created:**
- `src/components/admin/InlineFieldEditor.tsx` — compact inline form (label, key auto-slugged from label, type select, mandatory/visible switches, placeholder, advanced collapsible). Reuses the same upsert mutation already in `useFormBuilder`.

**Deleted:**
- `src/components/admin/FieldEditorDrawer.tsx` (replaced by inline editor; also removes the `SheetFooter` ref warning).

**Dependencies:**
- Add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (small, headless, Tailwind-friendly).

### Behaviour notes

- Built-in tabs cannot be reordered; the dnd sensor ignores them. Custom tabs can only be dragged within the custom range.
- Field reorder works on any tab (built-in or custom) since field overrides are per-tenant.
- All persistence is batched per drop to avoid N round-trips.
- Optimistic updates so the UI feels instant; a failed save reverts and shows a toast.

### Out of scope
- Drag-and-drop across tabs (moving a field from one tab to another).
- Multi-select / bulk delete of fields.
- Undo for reorders.

