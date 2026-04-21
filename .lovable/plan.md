

## Fix Garbled Email Body

### Problem
Emails arrive as gibberish characters because `send-smtp-email` marks content

<lov-plan>

## Fix Garbled Email Body in SMTP Edge Function

### Problem
The `send-smtp-email` Edge Function specifies `transferEncoding: "base64"` in `mimeContent` but passes raw (unencoded) text/HTML. Email clients interpret the raw content as base64, producing garbled characters.

### Solution
Remove the `mimeContent` field entirely from the `client.send()` call. The `denomailer` library natively handles `multipart/alternative` encoding when both `content` (plain text) and `html` fields are provided.

### Changes

**File: `supabase/functions/send-smtp-email/index.ts`**

Simplify the `client.send()` call by removing the `mimeContent` property:

```typescript
await client.send({
  from,
  to: toArr,
  cc: ccArr,
  bcc: bccArr,
  replyTo: replyTo || undefined,
  subject: body.subject,
  content: plainText,
  html: body.html,
});
```

Remove the `as any` type cast since we no longer need `mimeContent`.

**File: `supabase/functions/send-vendor-invitation/index.ts`**

Update company name references from "Ramky Infrastructure Limited" to "Sharvi" throughout the email HTML template (per project memory: app is rebranded to Sharvi Vendor Portal).

After editing, redeploy both Edge Functions.

