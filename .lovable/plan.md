## Problem

The cheque OCR call (`BANK_OCR`) is succeeding — your screenshot shows it returned `account_number: 1714348594` and `ifsc_code: KKBK0007746` with `message_code: "success"`.

The "Transaction rate limit exceeded. Please try again later." error is coming from the **second** API call — the Surepass **penny-drop** (`/api/v1/bank-verification/`) endpoint that runs after OCR to validate the account holder name. Surepass throttles this endpoint aggressively (typically 1 call per N seconds per account).

This is an **upstream provider throttle**, not a bug in our code. We need to handle it gracefully so vendors can still complete the Bank step.

## Fix

### 1. Auto-retry the penny-drop call with backoff
In `BankKycTab.tsx` `handleVerify`, when the BANK provider returns a `rate limit` / throttle message, automatically retry up to 2 times with delays (15s, 30s) before surfacing the error to the user. Show a "Retrying in Xs…" inline status so the vendor knows what is happening.

### 2. Treat OCR-only success as a soft pass when penny-drop is throttled
If after retries the penny-drop is still throttled, **commit the account number, IFSC, bank name and branch (from IFSC lookup)** to the form and mark the Bank tab as `passed` with a clear note: *"Account number and IFSC verified from cancelled cheque. Penny-drop name verification will be retried by the back-office team."* This unblocks vendors so they can submit, and admins can re-run the penny-drop later from the vendor record (the cheque file is already stored).

This soft-pass behaviour will only trigger on the specific `rate limit exceeded` upstream message — all other failures (invalid account, name mismatch, etc.) continue to block as before.

### 3. Tighten the inline hint in `DocumentVerificationStep.tsx`
The existing yellow "wait ~30 seconds and click Replace" hint will be replaced with a clearer message that explains we already retried automatically, plus a manual "Retry now" button that re-runs only the penny-drop step (no need to re-upload the cheque).

### 4. Cross-check name when penny-drop succeeds
The existing logic already compares `full_name` from the penny-drop response against `gstLegalName` and `panHolderName` with the right messages. No change needed there — it just needs the penny-drop call to actually go through.

## Files to change
- `src/components/vendor/kyc/BankKycTab.tsx` — add retry-with-backoff + soft-pass on rate-limit
- `src/components/vendor/steps/DocumentVerificationStep.tsx` — refine the inline rate-limit hint and add a "Retry penny-drop" action

No database or edge function changes required.
