# Compact Tenants column in User Management

## Problem
On the User Management screen, the **Tenants** column renders every assigned tenant as an individual badge. For users mapped to many tenants (e.g. all Ramky group entities + SAP country templates) the column explodes vertically, pushing the row hundreds of pixels tall and breaking the table layout (visible in the uploaded screenshot).

## Goal
Show a single compact chip in the Tenants column that displays the assigned count. Clicking it opens a popover that lists all tenants for that user, each removable inline — same behavior as today, just collapsed by default.

## Scope
Frontend only. No schema, RLS, or business-logic changes. The existing "Tenant" action button (which opens `AssignTenantDialog` to add more) stays as-is.

## Changes

**`src/pages/UserManagement.tsx`** — replace the tenants `TableCell` (lines ~445–458):
- If `u.tenants.length === 0` → keep `None` muted text.
- Else render a `Popover`:
  - Trigger: a `Badge` (clickable) showing `<Building2 icon> {count} tenant{s}`.
  - Content: scrollable list (max-h ~80, `overflow-y-auto`, min-w ~64) of all `u.tenants`, each row showing the tenant name + a small `×` button that calls the existing `handleRemoveTenant(u.id, t.id)`.
  - Header inside popover: small muted label "Assigned tenants ({count})".

Use existing imports: `Popover`, `PopoverTrigger`, `PopoverContent` (already used elsewhere in the project), `Badge`, `Building2`, `X` from lucide-react.

## Out of scope
- No change to `CreateUserDialog` (tenant picker there already uses `MultiSelect` with a count summary).
- No change to `AssignTenantDialog`.
- No change to the Custom Roles column.

## Verification
After edit, in preview: open `/users`, confirm rows with many tenants now show a single `N tenants` chip; clicking it opens the popover with the full list and per-tenant remove still works.
