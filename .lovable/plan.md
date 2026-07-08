# Fix: "Submitted At" in email showing UTC instead of IST

## Root cause
In `supabase/functions/notify-vendor-submission/index.ts` (lines 281–282), the timestamp is formatted with:

```ts
new Date(vendor.submitted_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
```

`"en-IN"` only sets the format (day-month-year, 12-hour). It does NOT set the timezone. Supabase Edge Functions run in **UTC**, so the email renders UTC time with Indian formatting. That is why a vendor who submitted at ~2:46 PM IST sees "9:16 am" in the email (9:16 UTC = 14:46 IST).

## Fix (single file, minimal change)

**File:** `supabase/functions/notify-vendor-submission/index.ts`

Change both `toLocaleString` calls (~lines 281–282) to include `timeZone: "Asia/Kolkata"`:

```ts
const submittedAt = vendor.submitted_at
  ? new Date(vendor.submitted_at).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    })
  : new Date().toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Kolkata",
    });
```

Result: email will display "8 Jul 2026, 2:46 pm" (IST) instead of "9:16 am" (UTC).

## Scope

- **Only** `supabase/functions/notify-vendor-submission/index.ts` — this is the file that generates the "Submitted At" line in the vendor submission / resubmission notification email you screenshotted.
- No changes to DB, RLS, submission logic, or other emails.

## Out of scope (not touched)

Other emails/UI already use `timeZone: 'Asia/Kolkata'` correctly (`process-approval-action`, `sap-team-reject-vendor`, `sap-team-return-to-buyer`, `sync-vendor-to-sap`, `ApprovalCommentsDialog`). Frontend `toLocaleString('en-IN')` calls in pages render in the user's browser timezone (already IST for Indian users) — not part of this fix. If you later want every outbound email and UI timestamp forced to IST regardless of viewer location, that would be a separate, larger pass.
