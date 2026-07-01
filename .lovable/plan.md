Remove the penny-drop success strips from the Bank tab.

Changes:
1. Edit `src/components/vendor/steps/DocumentVerificationStep.tsx`.
2. Remove the `CrossCheckStrip` block that renders `Account active · Penny-drop successful` when `bankDoc.status === "verified"`.
3. Remove the `CrossCheckStrip` block that renders `Secondary account active · Penny-drop successful` when `bankDoc2.status === "verified"`.
4. Leave all other penny-drop logic, status labels, and verification behavior unchanged.

Scope: UI-only removal of the two success banners. No changes to OCR, validation, API calls, save/submit, or back-button behavior.