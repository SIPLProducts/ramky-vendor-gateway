Plan:

1. Add a loading spinner during the Back → Yes reset
   - When the user confirms "Yes" on the "Go back to main screen?" dialog, show a full-screen (or overlay) spinner with the message "Clearing your data…" while the reset runs.
   - The reset already purges uploaded documents, validations, and saves a cleared draft — these calls take a few seconds, which is why the screen appears frozen.

2. Disable dialog buttons while clearing
   - Disable the Yes/No buttons and prevent closing the dialog until the reset finishes, so the user can't double-click and trigger multiple purges.

3. Land on the Vendor Type selection screen
   - Once the reset completes, hide the spinner and show the Domestic / International selection screen as before.

4. No other changes
   - No changes to token/on-behalf validation, OCR, KYC, save/submit, or the normal Previous button.

5. Validate
   - Click Back → Yes: spinner appears, buttons disabled, then vendor type selector shows.
   - Click Back → No: dialog closes with no changes.
   - Run TypeScript check.