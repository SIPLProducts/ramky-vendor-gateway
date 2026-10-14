# Clearer Messages When a Document Cannot Be Read

## Recommendation
Show a short, friendly message that tells the vendor what to do. Keep the provider's original message underneath in small text so support can still see the exact reason.

Example for PAN:
- Main line: "We could not read the PAN from this file. Upload a clear photo of the front of the PAN card, or enter the PAN manually."
- Small detail: "Provider: PAN Not Found."

## What changes
1. When the GST, PAN, or Bank reading service says it found nothing (for example `pan_not_found` or `no_gstin_detected`, or no fields came back), show the friendly line for that document type instead of only the raw provider text.
2. Show a friendly line for temporary provider problems too: timeouts (504, "Backend Timed Out") and server errors (5xx). Example: "The verification service is busy right now. Please try again in a minute, or enter the details manually."
3. Any other error keeps the provider's own message, as it does today.
4. The manual-entry popup, how documents are saved or kept, verification rules, the order of the stages, and the network payload all stay exactly as they are. Only the text the vendor sees changes.

## Technical details
- Add a small helper in `src/lib/` that turns (`documentType`, `message_code`, `status_code`, `message`) into `{ title, detail }`, plus unit tests for `pan_not_found`, a GST "not detected" code, 504 timeout, 5xx, and an unknown code falling back to the raw message.
- Use it only where OCR and verification errors are displayed in `DocumentVerificationStep.tsx`, and in the `toastKycResult` description.
- Nothing changes in the backend functions. To deploy, rebuild the frontend only.
