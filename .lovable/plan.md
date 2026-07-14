## Plan: Fix "Forgot Password" email delivery using the No-Reply SMTP config

**Issue:** UI shows "Password reset email sent successfully" but no email arrives. `send-smtp-email` logs the SMTP connect but never logs the delivery outcome, so a silently-dropped send (e.g. Gmail rewriting/rejecting a mismatched From) reports success.

**Fix scope:** Backend edge functions only. No UI changes.

### 1. `supabase/functions/send-smtp-email/index.ts`
- Capture `sendMail` result (`messageId`, `accepted`, `rejected`, `response`) and `console.log` it.
- If `accepted.length === 0` or `rejected.length > 0`, return `{ success:false, error }` with HTTP 502 so the caller can surface the real failure.
- On startup of each request, `console.warn` when the domain of `from_email` doesn't match the domain of the SMTP `username` (the common cause of silent Gmail drops).

### 2. `supabase/functions/send-password-reset/index.ts`
- Explicitly load the **No-Reply SMTP config** from `portal_config` (`smtp_host`, `smtp_port`, `smtp_encryption`, `smtp_username`, `smtp_password`, `smtp_from_email`, `smtp_from_name`) and pass it inline as the `smtp` override in the `send-smtp-email` invocation. This guarantees the reset email is sent using the No-Reply mailbox as From, regardless of any other per-user SMTP defaults.
- Propagate `sendData.success === false` (with its error) back to the client so the toast becomes an error instead of a false "sent successfully".

### 3. Verification
- Deploy both functions.
- Trigger "Forgot password" for a known user; read `send-smtp-email` logs for `accepted:[...]` + `messageId`. If accepted, the email is truly on its way (ask user to check Spam/All Mail). If not, the returned SMTP error will now be visible.

No schema changes, no new secrets, no UI changes.
