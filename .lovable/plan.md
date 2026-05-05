Remove the Reply-To header from the vendor registration invitation email.

## Change

**File:** `supabase/functions/send-vendor-invitation/index.ts`

In the call to `send-smtp-email` (around the `smtp: { ... }` payload), drop the `reply_to` field so no Reply-To header is set on outgoing invitation emails:

```ts
smtp: {
  host: smtpCfg.smtp_host,
  port: smtpCfg.smtp_port,
  encryption: smtpCfg.encryption,
  username: smtpCfg.smtp_username,
  password: smtpCfg.app_password,
  from_email: smtpCfg.user_email,
  from_name: smtpCfg.from_name ?? undefined,
  // reply_to intentionally omitted for vendor invitations
},
```

Also remove `reply_to` from the `.select(...)` list in the `smtp_email_configs` lookup since it is no longer used here.

## Scope

- Only the vendor invitation email is changed.
- Other emails (status notifications, finance approval, etc.) keep their existing Reply-To behavior.
- No DB, RLS, or UI changes.
- After edit, redeploy `send-vendor-invitation`.

## Result

Future invitation emails will show only `From:` (the configured sender) and `To:` (the vendor) — no `Reply-To:` line like `bala@sharviinfotech.com` shown in the screenshot.