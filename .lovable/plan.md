## Goal
Keep the Vendor Invitation dialog's **Company** field in sync with the header **tenant selector** (`Ramky Infrastructur…`) in both directions.

## Change
Single file: `src/pages/AdminInvitations.tsx`.

Currently the dialog stores `selectedTenantId` in local state and only seeds it once from `activeTenantId`. We will bind it to the global tenant context so changes flow both ways.

### Specifics
1. Pull `setActiveTenantId` (in addition to `activeTenantId`) from `useTenantContext()`.
2. Remove the local `selectedTenantId` state and the render-time initializer.
3. Compute `selectedTenantId` derived from context:
   - If `activeTenantId` is set and is in `allowedTenants` → use it.
   - Otherwise fall back to `allowedTenants[0]?.id` (and, when the dialog opens or list resolves, push that fallback into context via `setActiveTenantId` so the header reflects it too — only when no valid active tenant exists, to avoid clobbering "All Tenants" for super admins).
4. In the Company `<Select onValueChange>` handler, call `setActiveTenantId(value)` so picking a company in the dialog updates the header.
5. When the header tenant changes while the dialog is open, the derived value re-renders the Select automatically — no extra wiring needed.
6. For the single-company read-only branch, also push that tenant id into context on mount so the header stays consistent.
7. Keep `handleCreateInvitation` using the same id (now read from context).

### Guards
- Super admins viewing "All Tenants" (`activeTenantId === null`): keep current behavior — default the dialog to the first allowed tenant but do NOT auto-overwrite the header's "All" selection unless the user explicitly picks a company inside the dialog.
- No changes to backend, RLS, invitation creation logic, or other pages.
- Header components (`EnterpriseHeader`, `MobileHeader`) already use the same `setActiveTenantId`, so they update reactively with no edits needed.

## Validation
- Open `/admin/invitations`, change header tenant → dialog Company reflects it.
- Open dialog, change Company → header tenant updates.
- Single-tenant users: read-only Company still matches header.
- Super admin on "All Tenants": dialog defaults to a company without flipping header to that company; explicitly choosing one in the dialog updates the header.
