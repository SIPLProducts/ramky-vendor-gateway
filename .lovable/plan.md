## Issues

1. **Bank tab — wrong message text.** `BankKycTab.tsx` always says *"Account Holder Name does not match with the provided PAN/MSME details"*. MSME is never used in the comparison (bank is matched only against PAN holder name + GST legal name), and when GST is "No" the message still mentions PAN/MSME.
2. **PAN tab — verified message disappears on tab switch.** `PanKycTab.tsx` keeps its OCR result (`ocrPan`, `ocrName`, `panCheck`, `nameCheck`) in **local component state**. `KycTabs` uses Radix `<TabsContent>`, which unmounts inactive tabs, so leaving PAN and coming back wipes the green "PAN Number verified / PAN Holder Name verified" panel even though the field-level status is still "passed".

## Fix

### 1. Dynamic mismatch message in `src/components/vendor/kyc/BankKycTab.tsx`

- Build the reference list from whatever sources actually exist:
  - Both `panHolderName` and `gstLegalName` present → "PAN Holder Name and GST Legal Name"
  - Only `panHolderName` (GST = No) → "PAN Holder Name"
  - Only `gstLegalName` (rare) → "GST Legal Name"
- Use that string in **both** places that currently say "PAN/MSME details":
  - line 107 (`finalizePennyDrop` failure return)
  - line 297 (rendered failed-state panel)
- Remove the word "MSME" from these messages entirely (MSME is not used in bank name matching).

### 2. Persist PAN tab OCR result across tab switches

Lift the four pieces of state out of `PanKycTab.tsx` so they survive remounts:

- Add new optional props on `PanKycTab`:
  - `ocrPan`, `ocrName`, `panCheck`, `nameCheck`
  - `onOcrResultChange(result: { ocrPan, ocrName, panCheck, nameCheck })`
- Replace internal `useState` calls with controlled values from props (fall back to local state only if parent doesn't pass them, to keep the component reusable).
- In `src/components/vendor/steps/ComplianceStep.tsx`:
  - Add a `panTabResult` state (`{ ocrPan, ocrName, panCheck, nameCheck }`, default empty/idle).
  - Pass it + `onOcrResultChange={setPanTabResult}` to `<PanKycTab>`.
- Result: navigating PAN → MSME → Bank → back to PAN keeps the green "PAN Number verified with GST PAN Number" / "PAN Holder Name verified with GST Legal Name" rows visible.

No changes to API calls, validation logic, or other tabs.

## Files touched
- `src/components/vendor/kyc/BankKycTab.tsx` — dynamic mismatch text (2 spots).
- `src/components/vendor/kyc/PanKycTab.tsx` — accept controlled OCR-result props; emit changes upward.
- `src/components/vendor/steps/ComplianceStep.tsx` — hold `panTabResult` state and wire it into `<PanKycTab>`.