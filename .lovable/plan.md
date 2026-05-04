## Goal

Update the MSME tab validation to compare `name_of_enterprise` (from MSME API/OCR) against **both GST Legal Name AND PAN Holder Name** (full or partial via existing fuzzy matcher), with simplified messages. Keep the existing inline banner + AlertDialog UI shown in the screenshot.

## Required messages

- Match against both:
  - "Enterprise Name verified with GST Legal Name and PAN Holder Name."
- Match against only one (GST or PAN):
  - "Enterprise Name verified with GST Legal Name." (GST only)
  - "Enterprise Name verified with PAN Holder Name." (PAN only)
- Mismatch (neither matches):
  - "Enterprise Name does not match with GST Legal Name and PAN Holder Name."
  - Stop the process: dialog opens, inline banner shows error, MSME tab status stays `failed`, registration cannot advance.

## File to change

### `src/components/vendor/kyc/MsmeKycTab.tsx`

- Keep `enterpriseCheck` state values: `'idle' | 'gst+pan' | 'gst' | 'pan' | 'failed'`.
- Update `checkEnterpriseName(apiName)` to return the new message strings:
  - both → status `'gst+pan'`, message "Enterprise Name verified with GST Legal Name and PAN Holder Name."
  - GST only → status `'gst'`, message "Enterprise Name verified with GST Legal Name."
  - PAN only → status `'pan'`, message "Enterprise Name verified with PAN Holder Name."
  - neither → status `'failed'`, message "Enterprise Name does not match with GST Legal Name and PAN Holder Name."
  - `skipped` (no apiName, or neither GST nor PAN available) → unchanged.
- Update the `checkMessage` derivation block to return the same new strings per status.
- Update the `AlertDialog` description to: "Enterprise Name does not match with GST Legal Name and PAN Holder Name. Please re-check your MSME / Udyam certificate and resolve the mismatch before continuing." Title and single OK action stay as in screenshot.
- `handleManualVerify` and `handleOcrVerify` flows stay the same: on `'failed'` open the dialog and return `{ ok: false }` (which keeps the step blocked); on any match status return `{ ok: true, message: <new string> }`.

## Out of scope

- No changes to GST, PAN, or Bank tabs.
- No changes to `DocumentVerificationStep.tsx`, edge functions, or DB.
- `fuzzyNameMatch` already handles full/partial matching — no matcher change.
- `ComplianceStep.tsx` already passes both `panHolderName` and `gstLegalName` into `MsmeKycTab` — no wiring change needed.
