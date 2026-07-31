## Current behavior (verified)

In `src/components/vendor/steps/DocumentVerificationStep.tsx` (`runDocFlow`, ~line 1219), **any** OCR failure for a cheque opens the manual bank-entry dialog — including provider/configuration errors relayed from the KYC provider such as `Set use_pdf=True for PDF input` and `File required for multipart provider`. That's why the popup appears in both screenshots, with the provider error text used as the dialog subtitle.

## Change

1. Add a small classifier in the same file, e.g. `isProviderConfigError(msg)`, matching provider/transport-level failures rather than "couldn't read the document":
   - `use_pdf` / `use_pdf=True` / PDF-input errors
   - `File required for multipart provider`
   - other clearly non-OCR provider errors: "provider is not configured", "multipart", missing-file/invalid-request style messages

2. In the cheque branch of the OCR-failure path (`!ocrRes.success`), only call `openBankManualPopup(...)` when the error is *not* a provider config error. When it is:
   - keep the document in `failed` state with the provider's message shown inline (existing red banner) plus a short hint that the document couldn't be sent to the verification service and to re-upload as an image/PDF or contact support,
   - do not open the dialog.

3. Leave all other manual-popup triggers unchanged: low-confidence OCR, unreadable cheque, and penny-drop/verification failures still open the manual dialog as today.

## Technical notes

- Frontend only; no edge function or schema change.
- The same guard can be reused for the GST/PAN branches so a provider config error doesn't wrongly prompt manual GSTIN/PAN entry either (keeps behavior consistent; say if you'd rather restrict it to cheque only).
