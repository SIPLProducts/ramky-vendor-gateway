# Scope SAP Sync Buyer Companies to the Logged-In User

## Problem

On the SAP Sync screen, the "All Buyer Companies" dropdown lists every active buyer company in the system, regardless of who is signed in. It should list only the buyer companies assigned to the signed-in user in User Management.

Confirmed in code: the dropdown is fed by a query that selects all active rows from the tenants table with no user filter, and the SAP Team role is currently flagged as "sees all tenants" in the tenant context.

## What Changes

1. The dropdown on SAP Sync shows only the buyer companies assigned to the logged-in user (the assignment already stored in User Management).
2. The vendor lists on SAP Sync (SAP Sync, DMS Sync, Duplicate & Closed tabs) are limited to those same companies, so "All Buyer Companies" means "all of mine", not "all in the system".
3. Buyer-company names shown on each vendor card keep working for any company, even if unassigned.
4. Fallback: a user with no companies assigned (and full admins) continues to see all active companies, so nothing goes blank for Sharvi Admin / Customer Admin.

## Technical Details

- `src/hooks/useTenantContext.tsx`: stop treating the SAP Team custom role as blanket cross-tenant for the tenant list. SAP Team resolves its tenant list from `user_tenants` like other roles; if that list is empty, fall back to all active tenants (preserves today's behaviour for unassigned SAP users). Admin roles keep seeing all.
- `src/pages/SAPSync.tsx`: source the dropdown from the tenant context's `myTenants` instead of `useBuyerCompanies()`, and apply `myTenantIds` as a base filter on the vendor rows before the existing `buyerCompanyFilter`/search filters.
- Keep a separate all-tenants lookup solely for rendering company names on vendor cards (`getBuyerCompanyName`).
- No database or RLS changes; this is a client-side scoping change based on existing `user_tenants` assignments.
