## Problem

Today, when Surepass returns `429 / bank_rate_limited` for the penny-drop, the cheque step "soft-passes" — it shows a green banner ("Penny-drop name verification was skipped…") and lets the vendor click Continue. That's exactly what the screenshot shows: Account Holder Name is blank, but the step is treated as verified.

You want the opposite for both the rate-limit case **and** the name-mismatch case: stop, popup, disable Continue, allow re-upload.

## Changes (only `src/components/vendor/steps/DocumentVerificationStep.tsx`)

### 1. Remove the rate-limit soft-pass

In the `bank` branch of the verification function (~lines 537–591):

- Keep the existing 15s / 30s retry with backoff for `bank_rate_limited`.
- If we're still rate-limited after retries, **return `{ ok: false, message, reason: 'rate_limited' }`** instead of returning a soft-pass `{ ok: true, … pennyDropSkipped: true }`. This marks `bankDoc.status = 'failed'`, so `stage4Done` stays `false` and the outer Continue button (already gated on `allDone`) becomes disabled automatically.
- Drop the `holderNameStatus: "skipped"` / `pennyDropSkipped` paths entirely so the UI never shows "Penny-drop name verification was skipped".

### 2. Strict name-match logic with the three required messages

In the same branch (~lines 611–643), replace the current logic with:

```text
nameAtBank = data.full_name || data.name_at_bank
            || raw.data.full_name           // fallback for nested provider shape
gstLegal   = gstDoc.ocrData.legal_name
panHolder  = panDoc.ocrData.holder_name || panDoc.ocrData.full_name

gstOk = fuzzyNameMatch(nameAtBank, gstLegal)
panOk = fuzzyNameMatch(nameAtBank, panHolder)

if (gstOk && panOk) → ok=true,  message: "Account Holder Name verified with GST Legal Name and PAN Holder Name."
else if (gstOk)    → ok=true,  message: "Account Holder Name matched with GST Legal Name."
else               → ok=false, reason='name_mismatch',
                     message: "Account Holder Name does not match with GST and PAN details."
```

Note: the existing PAN-only success message is removed per spec — only GST+PAN, GST-only, or fail.

### 3. Popup dialog on bank failures

The file already imports `AlertDialog`. Add a single dialog driven by new local state in `DocumentVerificationStep`:

```ts
const [bankErrorDialog, setBankErrorDialog] = useState<{
  open: boolean;
  title: string;
  message: string;
  reason: 'rate_limited' | 'name_mismatch' | 'generic';
} | null>(null);
```

In `handleBankUpload` (or the bank `runDocFlow` callback), when the bank verifier returns `ok: false`, open the dialog with an error-tinted icon (`AlertCircle` in `text-destructive`) and the message returned. Titles:

- `rate_limited` → "Bank verification temporarily unavailable"
- `name_mismatch` → "Account Holder Name mismatch"
- `generic` → "Bank verification failed"

Dialog body shows the message; the single action button is "Re-upload cheque" which closes the dialog and resets `bankDoc` to `idleDoc` so the upload control is shown again. The user can then upload a new cheque and the flow re-runs.

### 4. Disable Continue in the bank section

`stage4Done` already drives the outer Continue (form-level submit gated on `allDone`). With change #1/#2, a failed bank verification keeps `stage4Done = false`, so Continue is naturally disabled. No additional gating is needed at the form level.

For clarity in the Bank stage panel, also surface a small inline destructive banner under the Account Holder Name field when `bankDoc.status === 'failed'` showing the same message — so the state is visible even after the dialog is dismissed.

### 5. Remove the misleading inline success banner when name is empty

The current UI shows "Account active · Penny-drop successful" + the green skipped-message under the empty Account Holder Name field. Once #1 lands, those branches no longer fire, so that misleading state goes away on its own.

## Acceptance

- Upload cheque → upstream returns `bank_rate_limited` (after retries): popup appears with the rate-limit message, Continue is disabled, user can re-upload.
- Upload cheque → penny-drop succeeds, name matches both GST + PAN: green inline message "Account Holder Name verified with GST Legal Name and PAN Holder Name.", Continue enabled.
- Upload cheque → penny-drop succeeds, name matches only GST: green inline message "Account Holder Name matched with GST Legal Name.", Continue enabled.
- Upload cheque → penny-drop succeeds, name matches neither: popup with "Account Holder Name does not match with GST and PAN details.", Continue disabled, re-upload allowed.
- No more "Penny-drop name verification was skipped" message anywhere.
