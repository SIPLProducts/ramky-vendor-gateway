# Show the API's Message in the "Enter Manually" Popup

## What is wrong now
When a GST or PAN document can't be read, the red line on the page already shows the API's own message (for example "PAN Not Found."). The manual-entry popup does not. Its text is fixed: "We couldn't read your PAN card. Please enter your 10-character PAN and we'll verify it."

## Change
For GST, PAN, and Bank manual-entry popups, the text is split into two parts:

1. **API message, highlighted.** The exact message the API returned (for example "PAN Not Found.") goes in a red-tinted box with an alert icon and bold text, just under the popup title.
2. **Our instruction, small and plain.** Below it, in small grey text: "Please enter your 10-character PAN and we'll verify it." (GST: "...15-character GSTIN..."; Bank: "Please enter your bank details manually.")

If the API sends no message, the highlighted box is hidden and only the small instruction shows.

The "couldn't read clearly" case (the service read the document but isn't confident) has no API error, so it shows only the small instruction.

## Unchanged
Saving and keeping documents, verification, mismatch checks, the stage order, toasts, the red line on the page, and the request payload stay exactly as they are. Only the popup text and its styling change.

## Technical details
- `DocumentVerificationStep.tsx`, `runDocFlow` around lines 1300–1340: pass `apiMessage` (from `ocrRes.error`) separately from the instruction text to `openGstManualPopup`, `openPanManualPopup`, and `openBankManualPopup`.
- Store `apiMessage` in each popup's state. Render it in a `bg-destructive/10 text-destructive font-semibold` box with an alert icon, and render the instruction as `text-sm text-muted-foreground`.
- Frontend-only change, so a frontend rebuild is enough to deploy it.
