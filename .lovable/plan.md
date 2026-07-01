No further changes required — the previously approved plan is already implemented and no other files were modified.

Summary of what was changed (only in `src/components/vendor/kyc/PanKycTab.tsx`):

1. Extracted the existing PAN Comprehensive fire-and-forget block into a `runPanComprehensive(pan)` helper. Same `callProvider({ providerName: 'PAN', input: { id_number, pan } })` call, same status/aadhaar_linked parsing, same silent try/catch.
2. Invoked `runPanComprehensive(extractedPan)` right after OCR yields a valid 10-char PAN, so it fires regardless of PAN-vs-GST match and regardless of GST=Yes/No.
3. Removed the duplicate inline IIFE inside the `panOk && nameOk` branch.
4. Widened the info-card render guard to show once `ocrPan` exists, so defaults ("Invalid" / "Aadhaar Not Linked with PAN") appear until the API returns.

Untouched: PAN OCR gating, GST verification, name cross-match, persistence in `ComplianceStep`/`useVendorRegistration`, DB schema, admin provider config, and all view/report screens.

If you'd like me to verify by running the build or a quick Playwright check, approve this plan and I'll do that in build mode.
