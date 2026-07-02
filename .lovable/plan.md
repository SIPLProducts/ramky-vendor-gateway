## Plan

1. **Fix the missing backend permission**
   - Update the `profiles` access rule so admin-like users can update any user profile status.
   - The current logged-in user has an Admin custom role, but the existing update rule only accepts the built-in `admin` role, so the update request can return success while changing zero rows.

2. **Make the edit popup action explicit**
   - Change the edit dialog button text from `Save` to `Update`.
   - Keep the current status dropdown in the edit popup.

3. **Detect failed/no-row updates in the UI**
   - After updating `profiles`, request the updated row back.
   - If no row is returned, show a clear failure message instead of showing “User updated”.

4. **Keep status cell coloring exactly as requested**
   - Active remains green only on the status label background.
   - Inactive remains red only on the status label background.
   - The full table cell remains uncolored.