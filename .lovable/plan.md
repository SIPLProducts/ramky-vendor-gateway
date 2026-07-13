## Goal
In the Replace User dialog, the "Replacement User" dropdown should list **all active users who share the same role** as the inactive user — regardless of tenant overlap. Same rule for every role (Buyer, SCM Head, Finance 1/2, CEO Office, Admin, etc.).

## Change

**File:** `supabase/functions/reassign-user-work/index.ts`

In the eligibility filter (preview mode), remove the tenant-overlap check. Keep the role check exactly as-is:

- If the inactive user has any active **custom role** → replacement must share at least one of the same custom role names.
- Otherwise → replacement must share at least one **built-in role** from `user_roles`.
- **Remove** the block that filters out candidates without an overlapping `user_tenants` entry.

Result: selecting any Buyer as the inactive user will list every other active Buyer in the system in the dropdown; same for SCM Head, Finance, etc.

## Not changed
- Apply-mode reassignment logic (transfers of approval flows, matrix, buyer↔SCM mappings) is untouched.
- Admin authorization, audit logging, impact counts unchanged.
- Frontend (`ReplaceUserDialog.tsx`) unchanged — it already renders whatever `eligible` list the function returns and fetches SAP tenants for the selected replacement.

## Technical detail
Delete these lines from the `.filter(...)` inside `reassign-user-work/index.ts`:

```ts
// Tenant overlap (skip if inactive had no tenants — global user)
if (inactiveTenantIds.length > 0) {
  const overlap = inactiveTenantIds.some((t) => tenants.includes(t));
  if (!overlap) return false;
}
```

The `candTenantsRes` query can stay (harmless) or be removed for cleanliness — I'll remove it since it's no longer used.
