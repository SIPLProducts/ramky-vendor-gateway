## Problem

1. Toggling a user to **Inactive** doesn't persist — the table keeps showing Active. Root cause: the `profiles` table only has a `Users can update own profile` RLS policy. When an admin edits another user, the `UPDATE` silently affects 0 rows (no error, no change). Only when editing oneself does it update.
2. The Status cell uses a small badge; the request is a full green/red background on that `<td>` only.

## Fix

### 1. Database migration — allow admins to update any profile
Add an admin UPDATE policy on `public.profiles` so status/full_name edits from User Management actually persist:

```sql
CREATE POLICY "Admins can update any profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
```

(existing self-update policy stays untouched)

### 2. UI — colour the Status cell
In `src/pages/UserManagement.tsx`, change the Status `<TableCell>` so the cell itself gets the background:
- Active → green background (`bg-green-100 text-green-800`) on the `<td>`
- Inactive → red background (`bg-red-100 text-red-800`) on the `<td>`
- Keep the label text ("Active" / "Inactive") centered inside the cell, drop the Badge wrapper.

No other logic, hooks, or edge functions change.

## Files touched
- new migration: admin UPDATE policy on `profiles`
- `src/pages/UserManagement.tsx` — status cell styling only
