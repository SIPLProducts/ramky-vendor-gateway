## Problem
In `src/pages/AdminInvitations.tsx`, the "New Invitation" flow inserts the vendor row into `vendor_invitations` first, then calls `send-vendor-invitation`. If the logged-in user is not configured in Email Configuration, the email step fails but the invitation row is already persisted — leaving an unsendable invitation in the list.

## Fix
Pre-validate the sender's SMTP config before any DB insert. Only insert + send if a valid active config exists for the logged-in user.

### Changes to `src/pages/AdminInvitations.tsx`
In `createInvitation.mutationFn`, before generating the token / inserting the row:

1. Query `smtp_email_configs` for the current `user.email`:
   ```ts
   const { data: cfg } = await supabase
     .from('smtp_email_configs')
     .select('id, is_active, app_password')
     .ilike('user_email', user!.email!)
     .eq('is_active', true)
     .maybeSingle();
   if (!cfg || !cfg.app_password) {
     throw new Error('You are not configured in Email Configuration');
   }
   ```
2. Only after this passes, proceed with the existing token generation + `vendor_invitations` insert + `send-vendor-invitation` invoke.
3. In `onError`, detect the "not configured" message and show the existing red "Email Not Configured" toast (instead of generic Error).

### Out of scope
- No edge function changes (server-side check already exists as a safety net).
- No DB / RLS changes.
- "Send Email" action on existing rows already behaves correctly (it only sends, doesn't insert) — no change needed there.

### Result
If the logged-in user has no active SMTP config, the dialog shows "Email Not Configured" and **no row is written** to `vendor_invitations`.
