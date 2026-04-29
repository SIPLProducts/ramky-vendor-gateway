# Fix: Show specific "You are not configured" error in Vendor Invitations toast

## Problem

When a logged-in user (e.g. vidyasagar) without an active row in **Email Configuration** clicks **Send Email** (or **Create Invitation**) on `/admin/invitations`, the edge function `send-vendor-invitation` correctly returns:

```
HTTP 400 { "error": "You are not configured in Email Configuration" }
```

But the UI shows a generic toast: **"Email Failed — Edge Function returned a non-2xx status code"**.

## Root Cause

`supabase.functions.invoke()` from the JS SDK treats any non-2xx response as an error: it sets `data = null` and `error = FunctionsHttpError` whose `.message` is the generic `"Edge Function returned a non-2xx status code"`. The actual JSON body (`{ error: "You are not configured..." }`) is on `error.context` (a `Response` object) and must be read with `await error.context.json()`.

The current code in `src/pages/AdminInvitations.tsx` only inspects `data?.error` and `error.message`, so the specific message is never detected and the generic toast wins.

## Fix

In `src/pages/AdminInvitations.tsx`, in **both** `createInvitation.mutationFn` and `sendEmailInvitation.mutationFn`, when `emailError`/`error` is present, parse the response body before falling back to the generic message:

```ts
let serverMsg = '';
if (emailError) {
  try {
    const ctx: any = (emailError as any).context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      serverMsg = body?.error || '';
    } else if (ctx && typeof ctx.text === 'function') {
      const txt = await ctx.text();
      try { serverMsg = JSON.parse(txt)?.error || txt; } catch { serverMsg = txt; }
    }
  } catch { /* ignore parse errors */ }
}

const notConfiguredMsg = 'You are not configured in Email Configuration';
if (serverMsg.includes(notConfiguredMsg) || (data as any)?.error?.includes?.(notConfiguredMsg)) {
  // createInvitation: return { invitation, emailSent: false, notConfigured: true }
  // sendEmailInvitation: throw new Error(notConfiguredMsg)
}
```

Result:
- **Create Invitation** flow: invitation row is still created, and the toast shows **"Email Not Configured — You are not configured in Email Configuration"** (existing onSuccess branch already handles this).
- **Send Email** (resend) flow: the destructive toast shows **"Email Not Configured — You are not configured in Email Configuration"** (existing onError branch already handles `isNotConfigured`).

No edge function changes — the backend already returns the correct payload. No schema changes.

## Files Changed

- `src/pages/AdminInvitations.tsx` — parse `error.context` JSON body in both mutations so the "not configured" message is detected and surfaced in the toast.
