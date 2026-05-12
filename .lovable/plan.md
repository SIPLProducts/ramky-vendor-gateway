# Fix: "Failed to send a request to the Edge Function" on No-Reply test

## Root cause
`portal_config.config_value` is stored as `{ "value": "smtp.gmail.com" }` (jsonb wrapper), but `supabase/functions/send-smtp-email/index.ts` uses the raw object directly. Result (from edge logs):

- `host = "[object Object]"`
- `port = NaN` → `TypeError: Invalid port: NaN`
- `from = "[object Object] <[object Object]>"` → invalid from address

The frontend (`NoReplyEmailConfig.tsx`) already unwraps with `unwrap(v)` — the edge function must do the same.

## Change
File: `supabase/functions/send-smtp-email/index.ts`

1. Add an `unwrap(v)` helper that returns `v.value` when `v` is an object with a `value` key, otherwise returns `v` (and handles `null`/primitives).
2. In `loadSmtpConfig`, store `unwrap(row.config_value)` in the `cfg` map so all downstream `String(...)` / `Number(...)` casts get the actual scalar.
3. Also coerce `smtp_enabled` properly (boolean) — currently unused in send path but keep consistent.
4. Re-deploy `send-smtp-email`.

No other files change. No DB or UI changes.

## Verification
- Click "Send Test Email" on `/admin/email-config` → No-Reply tab.
- Expect success toast and edge logs showing real host (`smtp.gmail.com`), port `587`/`465`, and a valid `From` address.
