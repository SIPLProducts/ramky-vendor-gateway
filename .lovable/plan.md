I checked the failed delete request from the User Management screen. The delete is still failing at the final auth-user deletion step with `Database error deleting user`.

Root cause found: the selected user still has linked rows in tables that the delete function does not currently clean up:

- `vendors.user_id` has 1 linked vendor row
- that vendor is blocked by `vendor_feedback.vendor_id` because `vendor_feedback -> vendors` is `NO ACTION`
- the user also has `vendor_feedback.user_id` data

So the function tries to delete the vendor/auth user, but the existing feedback row blocks the delete.

Plan to fix:

1. Update `supabase/functions/admin-delete-user/index.ts`
   - Add structured cleanup logging so the exact failing cleanup step is visible in logs.
   - Before deleting vendors owned by the user, handle `vendor_feedback` rows safely:
     - Set `vendor_feedback.user_id = null` where it points to the deleted user, so feedback history can remain.
     - Delete or detach feedback rows tied to vendors that are being deleted. Because `vendor_feedback.vendor_id` has `NO ACTION`, it must be handled before deleting the vendor row.
   - Keep the existing cleanup for:
     - reviewer references in `vendors`
     - `vendor_invitations.created_by`
     - `portal_config.updated_by`
     - `audit_logs.user_id`
     - role, tenant, custom-role, and profile rows
   - Then call the final auth-user delete.

2. Improve the error message returned to the UI
   - If the backend delete still fails, return a clearer message with the failing step, instead of only `Database error deleting user`.
   - This will make future issues immediately diagnosable from the toast/logs.

3. Deploy the updated `admin-delete-user` function
   - The current deployed function still appears to be the older version, so after updating code I will deploy this function explicitly.

4. Re-test the same delete flow
   - Use the failing user id from the request (`8be17860-ff5c-4196-a56d-89c8d85c96f0`) to verify the function no longer fails on vendor/feedback references.

No UI redesign is needed; the fix is in the backend delete function.