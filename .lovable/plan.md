
## 1. User Management — tab-level scoping rules

The screen currently applies one **Tenant Scope** selector to every tab. Goal: make scoping match the tab's purpose.

**Users / Custom Roles / Role Permissions tabs — always global**
- Hide the "Tenant Scope" card (or visually move it next to the Approval Matrix/Buyer-SCM tabs only).
- Stop filtering `scopedUsers`, `scopedCustomRoles`, `scopedCustomRoleRows` by `scopeTenantId` for these three tabs — always show all rows.
- Drop the "No users in this tenant" empty state for the Users tab.
- Access is decided purely by screen permission `user-management`. Any user (built-in or custom role) granted that screen sees and can manage everything in these three tabs — no extra role check, no hardcoded admin gate.
- Audit `RolePermissions` page + `CustomRolePermissionsMatrix` to make sure they query without `tenant_id` filter (Role Permissions config is global; tenant attribution stays in Approval Matrix only).

**Approval Matrix / Buyer SCM tabs — tenant-scoped (current behavior)**
- Keep `tenantId` selector inside these tabs (already exists in `ApprovalMatrixConfig` and via `BuyerScmMapping` prop).
- When picking approvers / SCM users, restrict the dropdown to users assigned to the selected tenant via `user_tenants` (Buyer-SCM already does this; verify Approval Matrix `ApproverPicker` filters by `user_tenants.tenant_id = selectedTenant`).
- Remove the page-level `scopeTenantId` and instead let each of these tabs own its own tenant selector, defaulting to the user's first tenant or "All" for super admins.

## 2. Email Configuration access

- Anyone whose screen permissions grant `email-configuration` should see and edit every SMTP config.
- Update the `list_smtp_configs` SQL function to drop the `sharvi_admin / admin / customer_admin` allowlist and instead return all rows for any authenticated user (access is already gated by the route's screen permission).
- Update RLS on `smtp_email_configs` so SELECT/INSERT/UPDATE/DELETE are allowed for any authenticated user (route guard enforces who sees the screen). Service-role edge functions are unaffected.

## 3. Invitation send failing on self-host server

The toast "Edge Function returned a non-2xx status code" comes from `send-vendor-invitation` returning 4xx/5xx on the on-prem instance (works on Lovable Cloud). The two likely causes on the self-hosted box:

- **No SMTP config for the buyer's sender email** in `smtp_email_configs` on the self-hosted DB (`check_my_smtp_configured()` would return false and the function aborts), or
- **`RESEND_API_KEY` env var not set** for the self-hosted Supabase functions runtime, so the Resend fallback path fails.

Plan:
1. Add explicit error responses in `send-vendor-invitation` that surface the real reason (e.g. "No SMTP config found for sender X" or "RESEND_API_KEY missing") so the UI toast shows a useful message instead of the generic non-2xx error.
2. Surface the upstream message in the `AdminInvitations` toast (`error.context?.error || error.message`).
3. Document in `SELFHOST_LINUX_HTTP.md` the two required pieces for the on-prem box: a row in `smtp_email_configs` for the inviter, and `RESEND_API_KEY` (optional fallback).

## Technical changes

- `src/pages/UserManagement.tsx` — remove `scopeTenantId` filter from Users/Custom Roles/Role Permissions tabs; keep selector visible only inside Approval Matrix / Buyer-SCM tab panels.
- `src/components/admin/ApprovalMatrixConfig.tsx` + `ApproverPicker.tsx` — keep tenant selector; ensure approver dropdown filters via `user_tenants`.
- `src/components/admin/BuyerScmMapping.tsx` — already tenant-scoped; receive its own tenant selector inside the tab.
- DB migration:
  - `CREATE OR REPLACE FUNCTION list_smtp_configs` — return all rows for any authenticated user.
  - Relax `smtp_email_configs` RLS policies similarly.
  - (Optional) helper to confirm Users/CustomRoles/Role-Permissions RLS already allow any user with the `user-management` screen permission to read — currently they require admin; add new policies using a `has_screen_permission(auth.uid(), 'user-management')` SECURITY DEFINER function.
- `supabase/functions/send-vendor-invitation/index.ts` — return structured `{ error, code }` JSON with HTTP 400/424 for the SMTP-missing and Resend-missing cases, instead of dropping the connection.
- `src/pages/AdminInvitations.tsx` — show the upstream error text in the toast.

## Open question

Before implementing, I need one confirmation:

For the on-prem server, do you want **SMTP-only** sending (i.e. every buyer must configure their Gmail/Office SMTP from the Email Configuration screen before they can send invitations), or should the function fall back to **Resend** when no per-user SMTP exists (which then needs `RESEND_API_KEY` set on the self-hosted box)?
