## Plan: Show sender's name instead of "Procurement Team"

### Change
In `supabase/functions/send-vendor-invitation/index.ts`, replace the hardcoded `"Procurement Team"` signature in the email HTML with the actual name of the user who is sending the invitation.

### How sender name will be resolved (priority order)
1. `from_name` from the matched `smtp_email_configs` row (already fetched in the function).
2. If empty, look up `profiles.full_name` (or equivalent) for the user matching `senderEmail` via the admin Supabase client.
3. If still empty, fall back to the part of `senderEmail` before `@` (title-cased).
4. Final fallback: `"Procurement Team"` (only if nothing else available).

### Edits
- After the `smtp_email_configs` lookup, compute `senderName` using the priority above.
- Replace the `<span style="...">Procurement Team</span>` line in the email HTML template with `${senderName}`.
- Keep all other styling, layout, and the "Respectfully," line unchanged.

### Deploy
- Redeploy `send-vendor-invitation` so the next invitation email shows e.g. `Suresh Mareddy` instead of `Procurement Team`.

### Result
The signature block in the vendor invitation email will read:
```
Respectfully,
<Sender's Name>
Ramky Infrastructure Limited
```
