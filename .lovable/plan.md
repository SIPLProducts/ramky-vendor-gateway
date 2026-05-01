## Problem

The bank verification dialog and inline banner show **hardcoded** strings instead of the actual upstream message returned by Surepass.

For the rate-limit case from your payload:
- Upstream returned: `"Transaction rate limit exceeded. Please try again later."`
- UI shows: `"Bank verification is temporarily unavailable due to upstream rate limits. Please wait a moment and re-upload the cancelled cheque to try again."`

Same problem will affect any other upstream failure (account not found, IFSC mismatch upstream, etc.) — wherever we wrote our own copy instead of forwarding `r.message` / `r.message_code`.

You want: whatever the API returns (success or failure) is what the user sees. No hardcoded strings.

## Root cause (in `src/components/vendor/steps/DocumentVerificationStep.tsx`)

Three places overwrite the upstream message:

1. **Lines 565–571** — rate-limit branch returns a hardcoded "temporarily unavailable…" string instead of `r.message` (the upstream "Transaction rate limit exceeded. Please try again later.").
2. **Line 569 + lines 691–696** — dialog title/body are derived from this hardcoded string, so even though the dialog box is fine the *content* is wrong.
3. **Lines 2024–2033** — the secondary warning panel under the file pill prints a fixed paragraph ("The verification service is temporarily throttled…") whenever the error text matches `/rate limit/`. This duplicates and contradicts the API message.

The bank-name-mismatch path (line 615–618) is also a hardcoded sentence — fine when there is no upstream message, but if the API ever returns a more specific reason we should prefer it.

## Changes

All edits in `src/components/vendor/steps/DocumentVerificationStep.tsx`. No other files touched.

### 1. Pass the upstream message through (lines ~561–578)

Replace the hardcoded rate-limit string and the generic failure fallback with the actual `r.message` / `r.raw.message`:

```text
const upstreamMsg =
  (typeof r?.message === "string" && r.message) ||
  (r?.raw && typeof r.raw.message === "string" && r.raw.message) ||
  "";

if (isRateLimited(r)) {
  return {
    ok: false,
    message: upstreamMsg || "Bank verification rate limited by provider. Please try again shortly.",
    messageCode: r.message_code,           // e.g. "bank_rate_limited"
    reason: "rate_limited",
  };
}

if (!r.found) {
  return { ok: false, message: upstreamMsg || "Bank validation provider is not configured." };
}
if (!r.ok || !r.data) {
  return {
    ok: false,
    message: upstreamMsg || "Bank verification failed.",
    messageCode: r.message_code,
  };
}
```

The fallback strings stay only as a last resort if the upstream returns no message at all — they will not be used in your current scenario because Surepass always returns `message`.

### 2. Drive the dialog title from `message_code`, body from `message` (lines ~688–697)

Stop pattern-matching on the user-facing string. Use the structured `messageCode`/`reason` returned from step 1:

```text
} else if (kind === "cheque") {
  const code = (v as any).messageCode || (v as any).reason;
  let title = "Bank verification failed";
  if (code === "bank_rate_limited" || code === "rate_limited")
    title = "Bank verification rate limited";
  else if (/Account Holder Name does not match/i.test(msg))
    title = "Account Holder Name mismatch";

  setMismatchDialog({ open: true, title, message: msg }); // msg is the upstream text
  setActiveTab("bank");
}
```

Result for your payload: dialog title = "Bank verification rate limited", body = "Transaction rate limit exceeded. Please try again later." — exactly what the API returned.

### 3. Remove the duplicate hardcoded warning paragraph (lines 2024–2033)

Delete the secondary `/rate limit/` warning block under the file pill. The `doc.errorMessage` line above it already shows the upstream message; the second paragraph just repeats hardcoded copy that contradicts it. After removal, only the API's own message is shown.

### 4. Forward `messageCode` on the verify return type

Add `messageCode?: string` and `reason?: string` to the `ok: false` return shape so the dialog logic in step 2 can read them. Pure type addition, no runtime change.

## Acceptance

Given your payload (`bank_rate_limited` / `"Transaction rate limit exceeded. Please try again later."`):

- Dialog title: "Bank verification rate limited"
- Dialog body: "Transaction rate limit exceeded. Please try again later." (verbatim from API)
- Inline banner under the cheque pill: "Transaction rate limit exceeded. Please try again later." (single banner, no extra hardcoded paragraph)
- Continue button stays disabled, "Re-upload cheque" still works.

For any other future upstream message (e.g. `"Account does not exist"`, `"Invalid IFSC"`), the same passthrough applies — whatever the API says is what the user sees, no code change needed.

## Files

- `src/components/vendor/steps/DocumentVerificationStep.tsx` (only file modified)
