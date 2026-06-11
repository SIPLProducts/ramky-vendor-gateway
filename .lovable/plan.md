
## Goal

Fix the Approval Matrix so approver dropdowns always list **every user with that role** (no tenant filtering), and the Buyer dropdown is the only one filtered by the Tenant Scope selector at the top.

## Current behaviour (the bug)

In `src/components/admin/ApprovalMatrixConfig.tsx`, the `usersByRole` memo filters every approver list by the **buyer's primary tenant**:

```ts
out[k] = list.filter((u) => userTenants.get(u.id)?.has(buyerPrimaryTenantId));
```

So Finance 1 / Finance 2 / CEO Office users disappear whenever they happen to be assigned to a different tenant than the buyer, even though approval roles are global. That's why the self-hosted server shows "No users with this role in the buyer's tenant".

## Changes (single file: `src/components/admin/ApprovalMatrixConfig.tsx`)

1. **Drop the tenant filter on approver dropdowns.**
   Replace the filtered `usersByRole` memo with the unfiltered `usersByRoleAll` — every SCM Manager, SCM Head, Finance 1, Finance 2, and CEO Office user is selectable for any buyer, regardless of tenant.

2. **Keep the Buyer dropdown tenant-aware.**
   Leave the existing `buyers` memo as-is: when **All Tenants** is selected, show all buyers; when a specific tenant is selected at the top, show only buyers assigned to that tenant.

3. **Update the empty-state text** in each approver `SelectContent` from *"No users with this role in the buyer's tenant"* to *"No users with this role."* (it's now a global statement).

4. **Update the helper banner** at the top of the card to match the new behaviour:
   *"Approval Matrix is Buyer-based. Approvers (SCM Manager, SCM Head, Finance 1/2, CEO Office) are global — the chain you save applies to every tenant the buyer has access to. The Tenant filter at the top only narrows which buyers and saved flows you see."*

5. **Save payload** stays unchanged: `tenant_id` continues to be derived from the buyer's primary tenant (used for the overview-table filter and downstream routing). No DB or migration change.

## Out of scope

- No database, RLS, or migration changes — the data is already correct; only the UI filter was over-restrictive.
- No change to `useVendorApprovalChain`, routing, or `seed_vendor_approval_progress` — they read by user-id, not tenant, so they're unaffected.
- No change to the Configured Buyers overview table or its tenant filter.

## Validation

1. With **All Tenants** selected, pick any buyer — every approver dropdown lists all users with that role across the system.
2. With a specific tenant selected at the top, the **Buyer** dropdown is narrowed to buyers in that tenant, but approver dropdowns still list all role-holders.
3. Save a flow, reload — the saved selections still render correctly in the chain preview and the Configured Buyers table.
4. On the self-hosted server, Finance 1 / Finance 2 / CEO Office dropdowns now show their users without needing any data fix.
