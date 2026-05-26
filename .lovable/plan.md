## Root cause

In a previous fix I added this override to both edge functions:

```ts
// WRONG — ignores user's configured port
if (/(^|\.)gmail\.com$/i.test(host) && port === 587) {
  effectivePort = 465;          // forces implicit TLS on 465
}
const useImplicitTls = encryption === "ssl" || effectivePort === 465;
```

That was added because Lovable Cloud's runtime had trouble with STARTTLS on 587. But on your on-prem host the firewall **blocks 465 and allows 587** — the exact opposite. Result: every send tries 465, times out after 25s, and the toast prints "port 465" even though Email Configuration is set to 587/TLS.

Your `nc` output is the proof: 587 succeeds, 465 hangs.

## Fix

Remove the Gmail-specific port hardcode in both functions. Always honor whatever the admin saved (or whatever the test panel passed in). Derive implicit-TLS from the **encryption** value, not from the port number:

- `encryption = "ssl"` → implicit TLS (typically port 465)
- `encryption = "tls"` or `"starttls"` → STARTTLS upgrade (typically port 587)
- `encryption = "none"` → plaintext

`denomailer`'s `connection.tls: true` means implicit TLS from the first byte. For STARTTLS we set `connection.tls: false` and tell it to upgrade — denomailer auto-issues STARTTLS on submission ports when `tls: false` and the server advertises it. We'll also pass an explicit `connection.auth` and keep the 25s timeout safety net so a wrong port still surfaces a clear error instead of `WorkerRequestCancelled`.

### Files to change

**`supabase/functions/send-smtp-email/index.ts`**

Replace this block (around the "Gmail STARTTLS" comment):

```ts
let effectivePort = port;
if (/(^|\.)gmail\.com$/i.test(host) && port === 587) {
  console.warn(
    "[send-smtp-email] Gmail 587 STARTTLS unreliable on self-host, using 465 implicit TLS",
  );
  effectivePort = 465;
}
const useImplicitTls = encryption === "ssl" || effectivePort === 465;
```

With:

```ts
// Honor the admin's configured port and encryption exactly.
// implicit TLS only when encryption === "ssl" (typical port 465).
// STARTTLS / TLS upgrade for "tls" or "starttls" (typical port 587).
const effectivePort = port;
const useImplicitTls = encryption === "ssl";
```

Keep the existing `withTimeout` wrapper and the retry without Reply-To. The error message string stays "check firewall egress on port `${effectivePort}` …" which will now correctly show 587 if 587 was configured.

**`supabase/functions/smtp-config-test/index.ts`**

Same edit — strip the Gmail 587→465 override; `useImplicitTls = encryption === "ssl"`; keep the 25s timeout.

### Why this is safe

- On Lovable Cloud: Gmail SMTP on 587 STARTTLS is the standard, documented path and works with `denomailer` when you pass `connection.tls: false`. The earlier "587 hangs on Cloud" only happened with one specific connection-object shape; the current `SMTPClient({ connection: { hostname, port, tls: false, auth } })` form is fine.
- On your on-prem host: 587 is open, so it will connect immediately, STARTTLS handshake, AUTH LOGIN with the App Password, send. Toast turns green.
- If anyone later configures encryption `ssl` and port `465`, that still works.
- If a host has a different firewall profile, the timeout message now reports the **actual port we tried**, not a hardcoded one, so debugging stays honest.

### Will Lovable Cloud still work after this change?

Yes — Cloud's egress allows both 465 and 587, and Gmail's 587 STARTTLS path works with denomailer's current API. I'm removing a workaround that has outlived its purpose.

### Files NOT changed

- No DB / portal_config changes — your existing row `smtp_port=587, smtp_encryption=tls` is already correct.
- No frontend changes.
- No new secrets.
- `send-vendor-invitation`, `notify-vendor-submission`, `send-status-notification`, `notify-finance-approval` all call `send-smtp-email`, so they get fixed automatically.

## After deploying

On your server:

```
git pull
sudo rsync -a --delete supabase/functions/ /opt/supabase/volumes/functions/
sudo docker compose -f /opt/supabase/docker-compose.yml restart functions
sudo docker compose -f /opt/supabase/docker-compose.yml logs --tail=20 functions | grep -E "send-smtp-email|smtp-config-test"
```

Then test:

1. **Admin → Email Configuration → Send Test Email** → expect green toast within 5s.
2. **Admin → Vendor Invitations → Send Email** on a row → expect green toast and the vendor receives the invitation.

Expected log line on success:
```
[send-smtp-email] Connecting host=smtp.gmail.com port=587 encryption=tls implicitTLS=false
```

If you still want a Resend HTTPS fallback as a belt-and-suspenders safety net later (so even a future firewall change can't break email), that's a separate small change — say the word and I'll add it. But it's no longer needed to fix the current issue.

## Summary of edits

| File | Edit |
|---|---|
| `supabase/functions/send-smtp-email/index.ts` | Remove Gmail 587→465 override; `useImplicitTls = encryption === "ssl"` |
| `supabase/functions/smtp-config-test/index.ts` | Same |

Approve and I'll switch to build mode and apply both edits.