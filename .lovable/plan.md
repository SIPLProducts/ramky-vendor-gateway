## Root cause (confirmed from edge logs)

`send-smtp-email` fails with:

> `The specified replyTo adress is not a valid email adress.` — denomailer

The No-Reply config has 3 Reply-To addresses joined as one string:

```
suresh.mareddy@ramky.com, pradeep.p@sharviinfotech.com, prasad.kvvk@sharviinfotech.com
```

`send-smtp-email/index.ts` (~line 106) joins them with `", "` and passes the whole thing as a single `replyTo`. denomailer only accepts one address there, so it throws and the entire send aborts → `notify-vendor-submission` returns 500 → UI shows the amber "buyer notification could not be sent" dialog. The buyer never receives the email.

## Fix — send to the buyer no matter what; gracefully skip bad Reply-To entries

User intent (confirmed): the buyer email is mandatory. The optional Reply-To list should be best-effort — drop invalid entries, and if none are valid send the email without any Reply-To rather than failing.

**One file: `supabase/functions/send-smtp-email/index.ts`**

1. Add a small `isEmail(s)` helper using a simple RFC-like regex (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`).
2. Parse `smtp_reply_to` / `body.replyTo` / `smtp.reply_to` into entries (split on `,`/`;`/newline, trim, drop empties).
3. For each entry, extract the bare email if wrapped as `Name <a@b>`, then keep only entries that pass `isEmail`.
4. Use the **first valid address** as `replyTo` in `client.send({ replyTo })` (denomailer only honours one).
5. Add the **remaining valid addresses as `Cc`** so they still receive the original notification (merged with any caller-supplied `cc`, deduped, excluding addresses already in `to`).
6. If the parsed list contains zero valid addresses, omit `replyTo` entirely and do **not** add anything to Cc — the email still goes to the buyer.
7. `console.warn` once with the dropped invalid values so admins can spot misconfiguration in logs.
8. Wrap the SMTP send in a `try/catch` that, if denomailer still rejects something Reply-To-related, retries once with `replyTo` and the extra Cc removed so the buyer email always goes through.

Apply the same parser + first-valid extraction in **`supabase/functions/smtp-config-test/index.ts`** so the "Send Test Email" button stops failing on the same configuration.

No DB migration. No UI changes. The No-Reply admin form keeps accepting multiple Reply-To addresses; invalid ones are now silently ignored at send time instead of breaking the whole notification.

## Verify

1. Redeploy `send-smtp-email` and `smtp-config-test`.
2. **No Reply Email Configuration → Send Test Email** → green success toast.
3. Submit a vendor application:
   - `send-smtp-email` log: no `validateConfig` error.
   - `notify-vendor-submission` returns `success: true`.
   - Success dialog shows the **green** "details have been sent to…" variant naming the inviting buyer.
   - Inviting buyer receives the email; the two extra Reply-To addresses appear in the Cc header.
4. Temporarily add a junk entry like `not-an-email` to Reply-To → save → resubmit. Email still delivers; logs show the junk entry was dropped.
5. Set Reply-To to only invalid values → email still delivers to the buyer with no Reply-To header and no Cc.

## Out of scope

- No change to `notify-vendor-submission`, `SubmissionSuccessDialog`, inviter resolution, or the No-Reply admin UI.
- No DB schema change, no provider switch (keeps existing Gmail SMTP).
