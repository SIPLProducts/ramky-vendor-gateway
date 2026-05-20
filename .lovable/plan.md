## Add an outer scrollbar to the Create User dialog body (keep inner tenants scroll)

The user wants the full dialog body (Full Name → Email → Password → Role → Tenants) to scroll as a single surface, while keeping the existing inner scroll inside the tenants list.

### Changes (only `src/components/admin/CreateUserDialog.tsx`)

1. **Make `DialogContent` a bounded flex column**
   - Update wrapper: `max-w-lg max-h-[90vh] flex flex-col p-0 overflow-hidden`.
   - Wrap `DialogHeader` in a fixed top region: `px-6 pt-6 pb-2`.
   - Wrap `DialogFooter` in a fixed bottom region: `px-6 py-4 border-t`.

2. **Add the outer scroll on the form body**
   - Wrap the existing `<div className="space-y-4 py-2">…</div>` in a scrollable container:
     `flex-1 overflow-y-auto px-6 py-4` with thin styled scrollbar using design tokens
     (`[&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-muted-foreground/30 [&::-webkit-scrollbar-thumb]:rounded-full`).

3. **Keep the inner tenants scroll as-is**
   - The tenants list keeps its `max-h-64 overflow-y-auto p-3 pr-2 space-y-2` container and the Select All header above it. No changes to tenants behavior.

### Out of scope
- No logic, validation, fetch, Select All, or backend changes.
- No changes to other dialogs or the shared `Dialog` primitive.