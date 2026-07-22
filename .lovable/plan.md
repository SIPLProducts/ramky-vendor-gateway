## Problem

On `User Management → Users` tab, the "All Roles" dropdown is incorrect:

1. Shows raw built-in role keys with underscores (`customer_admin`, `sharvi_admin`) and inconsistent casing.
2. Lists `vendor`, even though pure vendor users are hidden from this tab (dead option).
3. Missing the actual working roles used in the system: **Buyer, SCM CO, SCM Head, Finance 1, Finance 2, CEO Office, SAP Team** — these are custom roles and never appear in the filter.
4. Filter logic only compares `u.role` (built-in), so custom-role filtering wouldn't work even if listed.

## Target dropdown list

Per your list, the dropdown should contain exactly:

- All Roles (default)
- Buyer
- SCM CO
- SCM Head
- Finance 1
- Finance 2
- CEO Office
- SAP Team
- Admin
- Sharvi Admin

The first 7 (Buyer → SAP Team) are **custom roles** stored in `custom_roles` table. Admin and Sharvi Admin are **built-in** roles.

## Fix (scope: `src/pages/UserManagement.tsx` only)

1. **Rebuild dropdown options** dynamically:
   - `All Roles` first.
   - Custom roles from `customRoles` state, filtered to the known set (Buyer, SCM CO, SCM Head, Finance 1, Finance 2, CEO Office, SAP Team), ordered in that exact sequence. Option value = `custom:<id>`.
   - Built-in `Admin` (value `admin`) and `Sharvi Admin` (value `sharvi_admin`) appended at the end with clean Title Case labels.
   - Drop `vendor`, `finance`, `purchase`, `approver`, `customer_admin` from the filter (they're placeholder/legacy built-ins not used as user-facing roles anymore).

2. **Extend filter logic** in the `filtered` memo:
   - `all` → no role filter.
   - Value starts with `custom:` → keep users whose `customRoles[]` contains that id.
   - Otherwise → keep users whose built-in `u.role` equals the value.

3. **Trigger label**: render the selected option's clean label ("SCM CO", "Sharvi Admin"), not the raw key.

No changes to backend, schema, other screens, search box, or tenant scope.

## Technical notes

- `customRoles` is already loaded in `loadData()` — matched by exact `name` (case-insensitive) against the target list.
- If a target custom role doesn't exist in DB yet, it's simply skipped (dropdown stays clean).
- `nonVendorUsers` already hides pure vendors, so removing `vendor` from the filter aligns the two.
