## Goal

The Approval Matrix stays **Buyer-based**. The Tenant dropdown becomes a **filter-only** control — it does not change what gets saved. The flow is automatically tied to whichever Company/Tenant the selected Buyer already belongs to (via `user_tenants`).

## Changes

### 1. `ApprovalMatrixConfig.tsx` (frontend only)

- **Buyer dropdown**: list buyers filtered by the selected Tenant dropdown. When "All Tenants" is selected, show all buyers.
- **Tenant on save**: do **not** take tenant from the dropdown. Instead, derive `tenant_id` from the selected buyer's `user_tenants` row (first/primary tenant). The dropdown is purely a view filter.
- **Configured Buyers table**: filter rows by the selected tenant (join via `user_tenants` for each `buyer_user_id`). Show a small "Tenant" column so admins can see each buyer's company.
- Header helper text updated: "Approval Matrix is Buyer-based. Use the Tenant filter to view buyers of a specific company."
- Small UX: if a buyer belongs to multiple tenants, show the resolved tenant under the Buyer dropdown as read-only info.

### 2. No backend/schema changes

- `buyer_approval_flows` already keys on `buyer_user_id` (unique). The `tenant_id` column stays and is now populated automatically from the buyer's tenant on save — no migration needed.
- `seed_vendor_approval_progress`, `process-approval-action`, and `list-pending-approvals-by-stage` already resolve the flow by `buyer_user_id` only, so vendor routing and approval screens continue to work without changes.

### 3. Approval & vendor data integrity

- Existing saved flows remain valid (lookup is by buyer).
- New saves will stamp `tenant_id` from the buyer's `user_tenants` automatically, keeping reporting consistent.
- No change to Vendor Invitation → Submission → Approval → SAP Sync.

## Out of scope

- No DB migration, no edge function changes, no changes to approval screens or vendor flow.
- No changes to Users / Custom Roles / Role Permissions tabs.
