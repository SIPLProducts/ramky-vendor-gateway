## Problem

On the Bank tab, when the cheque OCR reads the account holder name **successfully** and the penny-drop API returns a valid account holder name, but that name doesn't cross-match the GST / PAN / MSME names, the flow currently opens the **"Bank verification — enter details manually"** dialog with the mismatch text as its description.

That popup is meant for the case where the OCR (or the penny-drop) couldn't read/verify the cheque — not for a genuine cross-field name mismatch on data that was read correctly.

## Root cause

In `src/components/vendor/steps/DocumentVerificationStep.tsx` (~lines 1265–1281), `runDocFlow` treats **any** failure returned by `verifyApi("cheque", …)` — including the cross-field Account Holder Name mismatch produced at ~line 1160 — as a "cheque couldn't be verified" case and unconditionally calls `openBankManualPopup(...)`.

The cheque verify path returns `ok:false` with `message = "Account Holder Name does not match any of the verified names …"` even when OCR + penny-drop both succeeded, and the outer handler doesn't distinguish that from a real read failure.

## Fix (scoped)

Distinguish "OCR/penny-drop couldn't verify the cheque" from "cross-field name mismatch on successfully read data" and only open the manual-entry popup for the former.

### Changes

1. `src/components/vendor/steps/DocumentVerificationStep.tsx` — bank OCR verify function (~lines 1149–1168):
   - When the cross-name check fails, return `{ ok: false, message, isNameMismatch: true }` (mirrors the MSME pattern already in use at line 1271).

2. Same file — `runDocFlow` cheque branch (~lines 1274–1281):
   - If `(v as any).isNameMismatch` is true, do **not** call `openBankManualPopup`. The existing inline "failed" state on the Bank tab (red banner under the cheque row with the mismatch message) already communicates the issue and lets the vendor replace/re-upload the cheque or fix the source names on GST/PAN/MSME tabs.
   - Keep opening the popup for all other cheque failures (OCR unreadable, low confidence, penny-drop provider error, rate-limit, account not found, etc.) exactly as today.

3. `src/components/vendor/kyc/BankKycTab.tsx` (admin Live Test panel) — apply the same behavior in `handleOcrVerify` / `finalizePennyDrop`: on a pure name-mismatch failure, keep the inline red banner (already rendered at lines 277–300) and skip any popup. The current code here already does not open the popup on name-mismatch, so this is a verification-only check — no functional change expected.

### Not touched
- GST / PAN / MSME manual-entry fallbacks — unchanged.
- Cross-name evaluation thresholds / `nameMatch.ts` — unchanged.
- Penny-drop API call, IFSC lookup, and downstream form persistence — unchanged.
- Popup content / manual-entry flow itself — unchanged; it just won't be triggered for name-mismatch.

## Result

After the fix, in the scenario the user described (GST/PAN/MSME verified, cheque OCR successful, penny-drop returned a name that doesn't cross-match), the vendor sees only the inline red mismatch banner under the cheque — no "Bank verification — enter details manually" dialog. The dialog still appears when the cheque genuinely can't be read or the penny-drop itself fails.