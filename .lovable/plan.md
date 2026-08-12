# Scope SAP Sync Tenant Filter to the Logged-In User

## Problem

On the SAP Sync screen, the filter dropdown is labelled "All Buyer Companies" and lists every active company in the system, regardless of who is signed in. It should be labelled "All Tenants" and list only the tenants assigned to the signed-in user in User Management.

Confirmed in code: the dropdown is fed by a query that selects all active rows from the tenants table with no user filter, and the SAP Team role is currently flagged as "sees all tenants" in the tenant context.

## What Changes

1. Label changes from "All Buyer Companies" to "All Tenants" (placeholder/search text updated to match).
2. The dropdown lists only the tenants assigned to the logged-in user (the assignment already stored in User Management).
3. The vendor lists on SAP Sync (SAP Sync, DMS Sync, Duplicate & Closed tabs) are limited to those same tenants, so "All Tenants" means "all of mine", not "all in the system".
4. Tenant names shown on each vendor card keep working for any tenant, even one not assigned to the user.
5. Fallback: a user with no tenants assigned (and full admins) continues to see all active tenants, so nothing goes blank for Sharvi Admin / Customer Admin.

## Technical Details

- `src/hooks/useTenantContext.tsx`: stop treating the SAP Team custom role as blanket cross-tenant for the tenant list. SAP Team resolves its tenant list from `user_tenants` like other roles; if that list is empty, fall back to all active tenants (preserves today's behaviour for unassigned SAP users). Admin roles keep seeing all.
- `src/pages/SAPSync.tsx`: source the dropdown from the tenant context's `myTenants` instead of `useBuyerCompanies()`, set `allLabel="All Tenants"` on the `TenantCombobox`, and apply `myTenantIds` as a base filter on the vendor rows before the existing tenant/search filters.
- Keep a separate all-tenants lookup solely for rendering tenant names on vendor cards.
- No database or RLS changes; this is a client-side scoping and label change based on existing `user_tenants` assignments.
