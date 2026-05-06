## Add "Buyer ↔ SCM Mapping" Tab in User Management

A new tab will sit beside **Approval Matrix** in `/admin/users`, letting admins map Buyers to SCM Managers so each Buyer sees only their related vendors and each SCM Manager sees only their assigned Buyers.

### 1. Database (new migration)

Create `public.buyer_scm_mappings`:
- `id uuid pk default gen_random_uuid()`
- `tenant_id uuid not null references tenants(id) on delete cascade`
- `buyer_user_id uuid not null` (profile id)
- `scm_manager_user_id uuid not null` (profile id)
- `created_at timestamptz default now()`
- `created_by uuid`
- Unique `(tenant_id, buyer_user_id, scm_manager_user_id)`

RLS: enable; policies allow `admin / sharvi_admin / customer_admin` (using existing `has_role`) to select/insert/delete mappings within their tenant scope. SCM Managers and Buyers can `select` rows where they are the `scm_manager_user_id` / `buyer_user_id` (so the app can filter their vendor list).

### 2. New component `src/components/admin/BuyerScmMapping.tsx`

Inputs:
- Pulls users via `profiles` joined with `user_custom_roles` + `custom_roles`:
  - **SCM Manager dropdown** = users assigned the custom role `SCM Manager`
  - **Buyer dropdown** = users assigned the custom role `Buyer`
- Tenant scope inherited from existing `scopeTenantId` prop (filter to users in that tenant via `user_tenants`).

UI layout:
- Card 1 — "Add Mapping": two `<Select>` fields (SCM Manager, Buyer) + **Save** button. Inserts into `buyer_scm_mappings`. Toast on success/duplicate.
- Card 2 — "Existing Mappings": `<Table>` columns `SCM Manager | Buyer | Created At | Actions (Delete)`. Loaded via join query. Delete button removes row.

### 3. Wire into `UserManagement.tsx`

- Add `<TabsTrigger value="buyer-scm">` after the Approval Matrix trigger with `Link2` icon.
- Add matching `<TabsContent value="buyer-scm">` rendering `<BuyerScmMapping tenantId={scopeTenantId === ALL_TENANTS ? null : scopeTenantId} />`.

### 4. Downstream filtering (consumed by existing screens, no UI work in this plan)

The mapping table is the source of truth that:
- `VendorList` / `My Approvals` for Buyers → show only vendors created_by themselves (already the case) plus any from their mapped SCM Managers' queue.
- SCM Manager approval screens → show vendors whose buyer is in their mapped buyer list.

This filtering wiring will be a follow-up; this plan only delivers the tab + storage as the user requested.

### Files

- create `supabase/migrations/<ts>_buyer_scm_mappings.sql`
- create `src/components/admin/BuyerScmMapping.tsx`
- edit `src/pages/UserManagement.tsx` (add tab trigger + content)
