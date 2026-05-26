## What's actually happening

`WorkerRequestCancelled: request has been cancelled by supervisor` is **not** an SMTP error. It's the self-hosted edge-runtime supervisor killing the worker because the function ran past its wall-clock budget (default ~150s on self-host, often lower) with no response.

The function is hanging inside `denomailer` during the **STARTTLS handshake to smtp.gmail.com:587** from your on-prem server (10.200.1.7). This is a known pattern:

- `smtp.gmail.com:465` (implicit TLS) → works reliably from Deno/denomailer.
- `smtp.gmail.com:587` (STARTTLS) → denomailer on edge-runtime frequently hangs forever if the upgrade handshake stalls (egress firewall partially allows 587, or TLS upgrade negotiation stalls). No error is thrown — the socket just sits there → supervisor kills it → `WorkerRequestCancelled`.

Last round I **removed** the Gmail 587→465 override per the plan, and that's exactly what broke your self-hosted server. Lovable Cloud's runtime tolerated 587; your on-prem edge-runtime does not.

The same applies to `send-smtp-email` (the "No-Reply test" payload you pasted hits that function and hangs identically).

## Fix

Put the Gmail safety override back, but make it explicit and bounded so it can't hang silently again. Apply to **both** `smtp-config-test` and `send-smtp-email` (and by extension the no-reply test path that uses `send-smtp-email`).

### 1. `supabase/functions/smtp-config-test/index.ts`
- If `host` ends with `gmail.com` **and** `port === 587`, transparently use `port = 465` with implicit TLS. Log a one-line warning so it's visible in logs ("Gmail 587 STARTTLS unreliable on self-host, using 465 implicit TLS").
- Wrap `client.send(...)` + `client.close()` in a `Promise.race` against a 25-second timeout. On timeout, throw a clean `SMTP connection timed out — check firewall egress on port 465/587 from server to smtp.gmail.com` so the toast shows a real reason instead of the supervisor killing the worker.
- Keep everything else as-is (no role gate, inline + saved-id both supported).

### 2. `supabase/functions/send-smtp-email/index.ts`
- Same Gmail 587→465 override.
- Same 25-second `Promise.race` timeout around `trySend()`.
- Keep the existing reply-to retry logic, audit log, etc.

### 3. No DB / no frontend changes
- `EmailConfiguration.tsx` already surfaces `e.message`, so the new timeout/clean error will appear in the toast.
- Schema unchanged.

## Why the previous "remove override" plan was wrong for you
The original plan assumed Lovable Cloud's runtime. Your deployment target is self-hosted edge-runtime behind your corporate network — different TLS stack, different egress posture, stricter supervisor. Gmail on 465 is the only path that's reliable in that environment. The 587 row in your DB stays as it is; the function just dials 465 when it sees Gmail.

## Files touched

```
supabase/functions/smtp-config-test/index.ts   (gmail 465 override + 25s timeout)
supabase/functions/send-smtp-email/index.ts    (gmail 465 override + 25s timeout)
```

## After you pull on the server

```
cd /opt/Ramky_Applications/DEV/VMS/<source>
git pull
supabase functions deploy smtp-config-test send-smtp-email --no-verify-jwt
docker compose -f <backend>/docker-compose.yml restart functions
```

Then retry **Send Test Email** and **No-Reply Test**. You will see either `success: true` or a real SMTP/timeout message in the toast — never `WorkerRequestCancelled` again.

## One confirmation

OK to force Gmail to **465 implicit TLS** even when the saved row says 587/TLS? (Recommended — your saved row stays 587 for display, the function silently dials 465 only for `*.gmail.com`. Any non-Gmail host is honored exactly as configured.)
