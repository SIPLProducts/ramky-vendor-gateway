## Issue
The signature shows "Ramky Vendor Portal" because the SMTP config's `from_name` (used as the email sender display name, e.g. "Ramky Vendor Portal") is currently the first choice for the signature. We need the signature to be the actual person who sent the invite, not the mailbox display name.

## Fix
In `supabase/functions/send-vendor-invitation/index.ts`, change the `senderName` resolution priority to favor the human's name over the SMTP `from_name`:

1. `profiles.full_name` for the user matching `senderEmail` (looked up via admin client) — primary
2. Title-cased local-part of `senderEmail` (e.g. `suresh.mareddy@…` → "Suresh Mareddy") — fallback
3. `smtp_email_configs.from_name` — only if it doesn't look like a generic brand/portal name (skip if it contains "portal", "team", "vendor", "support", "noreply", or matches the tenant `companyName`)
4. Final fallback: "Procurement Team"

Then keep the existing `emailHtml.replace("Procurement Team", senderName)` so the signature line renders the resolved person name.

## Deploy
Redeploy `send-vendor-invitation`.

## Result
Signature will read e.g.:
```
Respectfully,
Suresh Mareddy
Ramky Energy & Environment
```
instead of "Ramky Vendor Portal".
