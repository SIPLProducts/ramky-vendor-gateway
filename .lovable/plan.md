## Plan

### 1. Fix Admin role gating (User Management delete/update + other admin screens)

Currently `admin-delete-user` and `admin-create-user` only allow built-in roles `admin` and `sharvi_admin`. Users with `customer_admin` (or whose built-in role is the `approver` placeholder but who hold a custom role named "Admin / Sharvi Admin / Customer Admin") are rejected with "Forbidden: admin role required".

Changes (backend only — frontend already gates these screens via `useScreenPermissions`):

- **`supabase/functions/admin-delete-user/index.ts`**: replace the role check to allow when caller has any of the built-in roles `admin`, `sharvi_admin`, `customer_admin`, OR any active custom role whose name (case-insensitive) is `admin`, `sharvi admin`, or `customer admin`. Use the same `requireAuthenticatedUser` helper used elsewhere so custom-role names are recognised.
- **`supabase/functions/admin-create-user/index.ts`**: same expanded role check.
- Audit other admin-only edge functions and apply the same rule where the same "admin-only" intent exists:
  - `smtp-config-save`, `smtp-config-delete`, `smtp-config-test`: already accept any authenticated user (frontend-gated) — leave as-is.
  - SAP sync functions (`sync-vendor-to-sap`, `sync-vendors-to-sap-bulk`, `sync-vendor-to-dms`, `prepare-dms-payload`): already allow `admin`, `sharvi_admin`, `customer_admin`, plus `finance` and custom `SAP Team` — leave as-is.

No DB schema changes.

### 2. Include buyer company in the SAP sync notification email

In `supabase/functions/sync-vendor-to-sap/index.ts`, the buyer success email currently shows Vendor Legal Name, Trade Name, SAP Vendor Code, Reference No., Synced At. The vendor's buyer company is already stored as `vendors.tenant_id` (referencing `tenants` with `name` + `code`).

Change:
- After resolving `vendor`, fetch the tenant by `vendor.tenant_id` (`select name, code from tenants`).
- Add a row to the email table: **Buyer Company** → `${tenant.name} (${tenant.code})` (or just `name` if `code` missing). Render only when tenant resolves.
- Include `tenant_id`, `tenant_name`, `tenant_code` in the `sap_sync_buyer_notified` audit log details for traceability.

### Out of scope

- Frontend changes (the screens already render and call these functions).
- Schema migrations.
- Other approval/email flows.

### Verification

- Log in as `customer_admin` (or admin user from screenshot) → delete a non-self user → succeeds; audit log entry written.
- Create-user dialog works for the same caller.
- Trigger a SAP sync that reaches `successRow` → buyer receives email containing a "Buyer Company" row with tenant name+code; audit row includes tenant fields.
