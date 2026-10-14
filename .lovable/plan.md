# Show the API's Message in the "Enter Manually" Popup

## What is wrong now
When a GST or PAN document can't be read, the red line on the page already shows the API's own message (for example "PAN Not Found."). The manual-entry popup does not. Its text is fixed: "We couldn't read your PAN card. Please enter your 10-character PAN and we'll verify it." The cheque popup already uses the API message.

## Change
For GST, PAN, and Bank, when the reading service fails, the popup starts with the API's own message, then gives the instruction. For example:

- PAN: "PAN Not Found. Please enter your 10-character PAN and we'll verify it."
- GST: "<API message>. Please enter your 15-character GSTIN and we'll verify it."
- Bank: "<API message>. Please enter your bank details manually."

If the API sends no message, the current fixed text is used.

The "couldn't read clearly" case (the service read the document but isn't confident) keeps its current text, because no API error comes back there.

## Unchanged
Saving and keeping documents, verification, mismatch checks, the stage order, toasts, and the request payload stay exactly as they are. Only the popup text changes.

## Technical details
- `DocumentVerificationStep.tsx`, in `runDocFlow` around lines 1300–1312: build the popup text from `ocrRes.error` plus the instruction for each document type, and fall back to today's text when it's empty.
- Frontend-only change, so a frontend rebuild is enough to deploy it.
