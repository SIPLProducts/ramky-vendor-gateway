# Use Logged-in User's SMTP Config for Vendor Invitations

When an admin clicks **Create Invitation**, the invitation email should be sent **From** the logged-in user's email using the SMTP/App Password they saved in the **Email Configuration** screen, **To** the vendor's email. If the logged-in user has no matching active record in `smtp_email_configs`, the action should fail with the message: **"You are not configured in Email Configuration"**.

## Scope

- Applies to the `Create Invitation` flow (`AdminInvitations.tsx`).
- Also applies to the per-row `Send Email` / resend action on the same page (same intent — uses logged-in user's SMTP).
- Other system emails (status notifications, etc.) are out of scope and continue to use the existing portal-level SMTP.

## Behavior

1. On Create / Resend Invitation:
   - Backend looks up `smtp_email_configs` where `lower(user_email) = lower(<logged-in user email>)` AND `is_active = true`.
   - If found → send email using that config: `from = user_email`, `to = vendor email`, with `smtp_host/port/encryption/smtp_username/app_password/from_name/reply_to`.
   - If not found (or inactive / missing app password) → return error `You are not configured in Email Configuration`. The frontend shows it as a toast and does NOT show "Invitation Sent".
2. The vendor invitation row is still created in the DB even if email fails (current behavior preserved), but the toast clearly states the SMTP misconfiguration.

## Technical Changes

### 1. Edge function: `send-vendor-invitation`
- Accept new optional field `senderEmail` in the request body (the logged-in user's email).
- Before calling `send-smtp-email`, query `smtp_email_configs` (with service-role client) for an active row matching `senderEmail`.
- If not found → return `400 { error: "You are not configured in Email Configuration" }` and skip sending.
- If found → forward the SMTP credentials to `send-smtp-email` via the existing `smtp` override block:

```ts
{
  to: vendorEmail,
  subject,
  html,
  smtp: {
    host: cfg.smtp_host,
    port: cfg.smtp_port,
    encryption: cfg.encryption,
    username: cfg.smtp_username,
    password: cfg.app_password,
    from_email: cfg.user_email,   // From = logged-in user
    from_name: cfg.from_name,
    reply_to: cfg.reply_to,
  },
}
```

- Remove reliance on portal-level SMTP fallback for this flow. If `senderEmail` is missing from the request, also return the same "not configured" error.

### 2. `send-smtp-email` (no schema change required)
- Already supports an inline `smtp` override block; just verify the override path is used and the portal-config fallback is bypassed when override is provided. No code changes expected beyond ensuring the override fully wins over `portal_config` (it already does).

### 3. Frontend: `src/pages/AdminInvitations.tsx`
- In both `createInvitation` and `sendEmailInvitation` mutations, pass `senderEmail: user?.email` in the `supabase.functions.invoke('send-vendor-invitation', { body: { ... } })` call.
- Update error handling: if the edge function returns the "You are not configured in Email Configuration" error, show that exact message in the destructive toast (title: `Email Not Configured`, description: that string). Do not show the generic "Invitation Sent" toast in this case.

### 4. RLS / data access
- The lookup happens inside the edge function using the service role key, so no RLS policy changes are needed. We match strictly by `lower(user_email)` to avoid case mismatches.

## Out of Scope

- Editing the `Email Configuration` screen UI.
- Changing the schema of `smtp_email_configs`.
- Changing other email flows (status notifications, finance approvals, etc.).
