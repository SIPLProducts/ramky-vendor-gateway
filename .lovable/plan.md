# How email works today (explanation only, no code changes)

## Short answer
Emails are sent by the **backend server functions**, not the frontend and not the SAP middleware. The middleware (Node service on port 3002) only handles SAP calls; it has no email code.

## Flow

```text
User action in browser (invite, submit, approve, reject, SAP sync, test email)
   |  HTTPS call with user session
   v
Business backend function (e.g. send-vendor-invitation, notify-vendor-submission,
process-approval-action, buyer-return-to-vendor, sap-team-reject-vendor,
send-status-notification, sync-vendor-to-sap)
   |  builds subject + HTML, picks recipients
   |  server-to-server call (shared checked invoke helper)
   v
send-smtp-email  (the ONLY component that actually sends)
   |  reads SMTP settings from portal_config table:
   |  smtp_enabled, host, port, encryption, username, password,
   |  from email/name, reply-to (password never returned to browser)
   |  opens SMTP connection with nodemailer
   v
SMTP server (e.g. smtp.gmail.com:587 TLS / 465 SSL)
   |  authenticates with username + app password
   v
Recipient mailbox (vendor / buyer / approvers, plus configured CC)
```

## Configuration path
1. Admin opens Admin -> Email Configuration (No-Reply Email card).
2. "Test" calls `smtp-config-test`, which sends a test message with the typed values.
3. "Save" calls `smtp-config-save`, which stores values in `portal_config`; the password stays server-side and is shown masked.
4. Every later email reads these saved values at send time.

## Responsibilities
- Frontend: triggers actions, shows success/error toasts; never holds SMTP password, never talks to SMTP.
- Business functions: decide who gets which email and the content.
- `send-smtp-email`: loads config, validates addresses, connects to SMTP, sends, returns messageId or the exact SMTP error.
- SMTP provider: delivers to the recipient.
- SAP middleware: not involved.

## Notes
- If SMTP is disabled or settings are incomplete, sending fails and the error is returned to the calling function.
- Gmail error `535-5.7.8 BadCredentials` means the app password in Email Configuration is wrong/revoked.
- Vendor registration confirmation and vendor SAP-success emails are intentionally switched off; buyer emails continue.
- Self-hosted servers must have outbound access to the SMTP port (587/465).

Approving this changes nothing in the app; it only confirms the explanation.
