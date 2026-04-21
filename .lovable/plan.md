

## Scope data by user + tenant across the application

### Problem

- All vendors in the database currently have `tenant_id = NULL`, so even after we add tenant filters there is nothing to filter on.
- Frontend list/stats queries (`useVendors`, `useVendorStats`, `DocumentVerification`, `GstCompliance`, `AdminInvitations`, `AuditLogs`) fetch every row.
- Database RLS on `vendors`, `vendor_invitations`, `vendor_documents`, `vendor_validations`, `validation_api_logs`, `audit_logs`, `ocr_extractions` lets `finance` / `purchase` / `sharvi_admin` / `customer_admin` users see ALL rows regardless of which tenant(s) they belong to. The only role currently scoped properly is the per-level approver via `approval_matrix_approvers`.
- `UserManagement` already lists every profile globally — customer admins should only see users from their own tenant(s).

### Goal

Each signed-in user sees only data that belongs to a tenant they are mapped to in `user_tenants`, with these role exceptions:

| Role | Visibility |
|---|---|
| `vendor` | Only their own vendor record (unchanged — already by `user_id`) |
| `customer_admin`, `finance`, `purchase`, `approver`, custom-role users | Only data where `vendors.tenant_id` ∈ their `user_tenants.tenant_id` set |
| `sharvi_admin`, `admin` | All tenants (super-admin) — with an optional **Active Tenant** switcher in the header to filter the view |

### Plan

#### 1. Backfill + enforce tenant on vendor data (DB migration)

- Backfill `vendors.tenant_id` for the 13 existing rows: assign them to the only existing tenant `Ramky Infrastructure Limited` (so admins/devs can see data immediately). Sample/seed vendors get the same default.
- Add a SECURITY DEFINER helper `public.user_tenant_ids(_user_id uuid) returns setof uuid` that returns the caller's tenant ids — used in RLS to avoid recursion.
- Replace permissive RLS on these tables with tenant-scoped versions (super admins keep full access):
  - `vendors` — finance/purchase/customer_admin SELECT/UPDATE only when `tenant_id` is in caller's tenant set
  - `vendor_invitations` — same scope (already has `tenant_id` column)
  - `vendor_documents`, `vendor_validations`, `validation_api_logs`, `ocr_extractions`, `audit_logs` — scope via the parent vendor's `tenant_id`
  - `profiles` — customer_admin can see profiles of users that share at least one tenant; otherwise only own profile

#### 2. Add a tenant context to the app

New file `src/hooks/useTenantContext.tsx` exposed via `<TenantProvider>` (mounted in `App.tsx` inside `AuthProvider`):

- Fetches `user_tenants` for the current user once.
- Exposes `{ myTenantIds, activeTenantId, setActiveTenantId, isSuperAdmin }`.
- Persists `activeTenantId` in `localStorage`.
- For super admins: `activeTenantId = null` means "all tenants"; otherwise filter to selected.
- For everyone else: defaults to their `is_default` tenant or first; cannot be cleared.

#### 3. Add an Active Tenant switcher in the header

- `EnterpriseHeader.tsx` — show a `Select` listing the user's tenants (super admins also get an "All tenants" option). Hidden when the user has only one tenant.

#### 4. Apply the tenant filter on the client

Update list queries to add `.in('tenant_id', myTenantIds)` (or `.eq('tenant_id', activeTenantId)` when one is selected). RLS is the security boundary; the client filter just keeps the UI tidy and supports the super-admin switcher:

- `src/hooks/useVendors.tsx` — `useVendors`, `useVendorStats`, `useBuyerCompanies`
- `src/pages/DocumentVerification.tsx`, `src/pages/GstCompliance.tsx`, `src/pages/FinanceReview.tsx`, `src/pages/PurchaseApproval.tsx`, `src/pages/SAPSync.tsx`, `src/pages/VendorList.tsx`, `src/pages/Dashboard.tsx`
- `src/pages/AdminInvitations.tsx` — filter `vendor_invitations`
- `src/pages/AuditLogs.tsx` — join via vendor's tenant
- `src/pages/UserManagement.tsx` — load only profiles whose `user_tenants` overlap caller's tenant set (super admins see all)
- `useCreateVendor` / vendor invitation creation — set `tenant_id = activeTenantId ?? defaultTenantId` so new records are scoped from creation

#### 5. Wire the existing `tenant_id` on creation paths

- `useVendorRegistration.tsx` insert path — populate `tenant_id` from the invitation (`vendor_invitations.tenant_id`) or the active tenant.
- `send-vendor-invitation` flow — already accepts a tenant; ensure UI passes the active tenant when no explicit choice is made.

### Files touched

- New: `supabase/migrations/<timestamp>_tenant_scoped_rls.sql`, `src/hooks/useTenantContext.tsx`
- Edited: `src/App.tsx`, `src/components/layout/EnterpriseHeader.tsx`, `src/hooks/useVendors.tsx`, `src/hooks/useVendorRegistration.tsx`, `src/pages/Dashboard.tsx`, `src/pages/VendorList.tsx`, `src/pages/FinanceReview.tsx`, `src/pages/PurchaseApproval.tsx`, `src/pages/SAPSync.tsx`, `src/pages/DocumentVerification.tsx`, `src/pages/GstCompliance.tsx`, `src/pages/AdminInvitations.tsx`, `src/pages/AuditLogs.tsx`, `src/pages/UserManagement.tsx`

### Out of scope

- Changing the existing approver-matrix scoping (already correct).
- Changing vendor self-service screens (already user-scoped by `user_id`).
- Migrating historical audit log rows that have no `vendor_id` — they remain visible only to super admins.

