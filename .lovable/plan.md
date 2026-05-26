## What's actually wrong

### 1. "Dropdown, not a button" for company/tenant
`TenantCombobox` (used on User Management → Tenant Scope and inside the Create User / Assign Tenant flows) is implemented as a `<Button variant="outline">` triggering a `Popover` + `Command`. Functionally it is searchable, but visually it renders as a button — that's why you keep saying "this is a button, I want a dropdown".

### 2. Invitation email "not going"
- `send-vendor-invitation` looks up `smtp_email_configs` by the logged-in user's email (`senderEmail = user?.email`). If your server account's email is not exactly one of the rows in `smtp_email_configs`, it returns "No SMTP configuration found for …" and no email is sent.
- Current rows in DB: `sunilakula1919@gmail.com`, `vidyasagar.atla@ramky.com`, `suresh.mareddy@ramky.com`. If the user clicking Send Email is logged in as anyone else (e.g. an admin), the function bails out.
- `send-smtp-email` force-overrides Gmail port to 465 with implicit TLS, ignoring what you saved (587/TLS). That's the "465" you saw in logs — it's not hardcoded credentials, it's a port override. You asked for it to use exactly what's in Email Configuration.
- The UI toast only shows a generic "Failed to send email" because the error chain swallows the real reason in some paths.

## Changes

### A. Tenant picker → real dropdown look (`src/components/admin/TenantCombobox.tsx`)
Replace the `<Button>` trigger with a div styled exactly like a shadcn `SelectTrigger` (same height, border, chevron, focus ring). Keep the `Popover` + `Command` search inside so it stays searchable. No behavior change — same props, same callers, just looks like a native select.

### B. Create User dialog tenant picker (`src/components/admin/CreateUserDialog.tsx`)
The current SAP-tenant section shows a checkbox list. Add a compact searchable dropdown variant on top (single or multi via the same select-styled trigger) so it matches the rest of the UI. Keep checkbox list behind a "Show all" toggle for bulk selection. (If you only want it dropdown-only, say so and I'll remove the checkbox list entirely.)

### C. Invitation email — actually use Email Configuration

In `supabase/functions/send-vendor-invitation/index.ts`:
1. Sender resolution order:
   a. Match `smtp_email_configs.user_email` ILIKE `senderEmail` (current).
   b. If none, fall back to **any** active `smtp_email_configs` row (deterministic: most recently updated). This makes "send works for any admin" the default.
   c. If still none, return the friendly error and surface it in the toast.
2. Return the **actual** SMTP error string in the response body so `AdminInvitations.tsx` shows the real reason.

In `supabase/functions/send-smtp-email/index.ts`:
1. **Remove the Gmail 587 → 465 override.** Use exactly the `smtp_port` and `encryption` saved in Email Configuration. (Both 465/SSL and 587/STARTTLS work with denomailer when configured correctly — your row for `sunilakula1919@gmail.com` is 587/TLS, keep it.)
2. Keep the Gmail-username-must-be-email guard (that one's correct).
3. Surface the raw SMTP error in the response (already mostly there — verify the 535 friendly mapping doesn't hide other 5xx codes).

In `src/pages/AdminInvitations.tsx`:
- When the toast fires, include the server `error` field verbatim so you can see what's actually failing on the server (already partially there — confirm it surfaces `respErrMsg`).

### D. Redeploy (you do this on your on-prem server)
After pulling:
- `supabase functions deploy send-vendor-invitation send-smtp-email --no-verify-jwt`
- Rebuild and replace `dist/`

## Files touched

```
src/components/admin/TenantCombobox.tsx          (visual: button → select-style trigger)
src/components/admin/CreateUserDialog.tsx        (tenant section: add dropdown)
src/pages/AdminInvitations.tsx                   (toast: show real server error)
supabase/functions/send-vendor-invitation/index.ts  (sender fallback + error passthrough)
supabase/functions/send-smtp-email/index.ts      (remove Gmail port override)
```

## Two quick confirmations before I implement

1. **Sender fallback for invitations**: OK to fall back to any active SMTP config row when the logged-in admin doesn't have their own row? (Recommended — otherwise you must add a config row for every admin who sends invites.)
2. **Create User dialog tenants**: dropdown-only, or dropdown + keep the existing checkbox list as a secondary "select multiple" view?
