## Problem

The Lovable Cloud edge logs for `smtp-config-test` show:

```
event loop error: Error: invalid cmd
  at SMTPConnection.assertCode (denomailer/.../connection.ts:57:13)
smtp-config-test error BadResource: Bad resource ID
  at Object.startTls (ext:deno_net/02_tls.js)
  at SMTPClient.#prepareConnection (denomailer/.../client.ts:201:31)
```

This is a known `denomailer@1.6.0` bug on the current Deno edge runtime: when doing STARTTLS on port 587, the EHLO/STARTTLS handshake aborts and the underlying TCP resource gets closed before TLS upgrade — hence both `invalid cmd` and `BadResource`. The data (587/tls) is correct; the SMTP library is broken in this runtime.

The previous timeout/port fix (465 → 587) was necessary but not sufficient — denomailer itself can't complete STARTTLS here.

## Fix

Replace `denomailer` with `nodemailer` (Node-compat via `npm:` specifier), which handles Gmail STARTTLS reliably in Deno Edge Runtime and is the de-facto SMTP client.

### Files to change (3 edge functions, ~20 lines each)

1. **`supabase/functions/smtp-config-test/index.ts`**
2. **`supabase/functions/send-smtp-email/index.ts`**
3. **`supabase/functions/send-vendor-invitation/index.ts`**

In each:
- Replace `import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"` with `import nodemailer from "npm:nodemailer@6.9.14"`.
- Replace the `new SMTPClient({ connection: { hostname, port, tls, auth } })` block with:
  ```ts
  const transporter = nodemailer.createTransport({
    host, port,
    secure: encryption === "ssl",   // true for 465 implicit TLS, false for 587 STARTTLS
    auth: { user: username, pass: password },
  });
  ```
- Replace `client.send({ from, to, cc, subject, content, html })` with `transporter.sendMail({ from, to, cc, subject, text: content, html })`.
- Remove `client.close()` (nodemailer pools clean up automatically; optional `transporter.close()` is fine).
- Keep the existing 25 s timeout wrapper, port/encryption logic, CC fallback, and CORS — only swap the SMTP client.

No DB migration, no config change, no secret change. After deploy, both:
- Lovable Cloud "Send Test Email" on `/admin/email-config`
- On-prem `send-vendor-invitation` (after they rsync the new code)

will complete STARTTLS on 587 and deliver via Gmail.

## Verification

1. Deploy the three functions.
2. From `/admin/email-config`, click Send Test Email for each Gmail row → expect `{ success: true, sentTo: ... }` and an inbox delivery within ~5 s.
3. Tail `smtp-config-test` logs → no more `invalid cmd` / `BadResource`.
4. Send a vendor invitation → confirm email arrives.

## Out of scope

- No UI changes.
- No change to `smtp_email_configs` rows (they are already 587/tls).
- No change to the on-prem deployment process; they still need to `git pull` + `rsync` + `docker compose restart functions` to pick up the new code on their box.
