

## Simplify Vendor Invitations Table Columns

### Changes to `src/pages/AdminInvitations.tsx`

**1. Rename "Name" column → "Vendor Name"**
- Update the `<TableHead>` label from "Name" to "Vendor Name" so it's unambiguous.

**2. Remove the "Company" / Tenant column entirely**
- Drop the column header and its corresponding `<TableCell>` from each row.
- Rationale: Each user (admin/customer_admin) is already scoped to their own tenant via `user_tenants`. Showing the company on every invitation row is redundant noise.

**3. Form-side cleanup (Send Invitation dialog)**
- If the dialog currently exposes a "Company / Tenant" picker for the inviter, remove it and auto-derive the `tenant_id` from the logged-in user's default tenant (`useTenant` hook / `user_tenants.is_default = true`).
- Sharvi admins (who span multiple tenants) keep the picker — only hide it for `admin` / `customer_admin` whose tenant is fixed.

### Files Touched

- `src/pages/AdminInvitations.tsx` — header rename, column removal, conditional tenant picker in the send dialog.

### Out of Scope

- No DB schema change. `vendor_invitations.tenant_id` stays — it is still stored, just not displayed/asked.
- No edge function changes.

