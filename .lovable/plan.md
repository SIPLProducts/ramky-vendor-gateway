Change the Status column so the color background wraps only the status label, not the entire table cell.

In `src/pages/UserManagement.tsx` (the users table, around lines 543-551):
- Revert the `<TableCell>` to a plain neutral cell (centered).
- Inside it, render the status as a small inline pill/badge:
  - Active → green background (`bg-green-100 text-green-800`), rounded, small padding.
  - Inactive → red background (`bg-red-100 text-red-800`), rounded, small padding.
- Only the label pill is colored; the surrounding cell stays default.

No backend or logic changes.