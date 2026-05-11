# Plan

## Point 1 — MSME "No" hides all non-registered fields

In `src/components/vendor/kyc/MsmeKycTab.tsx`, when `isMsmeRegistered === false`:

- Remove the entire `!props.isMsmeRegistered` block (Alert, Download template button, Reason textarea, Signed Self-Declaration FileUpload).
- Show only the Yes/No radio group. No further fields appear.
- Update the status reporter so "No" reports `na` directly (no longer waits for a self-declaration file): `status = !isMsmeRegistered ? 'na' : state.status`.
- Keep props (`msmeSelfDeclarationFile`, `onMsmeSelfDeclarationFileChange`, `msmeDeclarationReason`, `onMsmeDeclarationReasonChange`) in the interface as optional but unused inside the component, so parent callers don't break. Parent (`DocumentVerificationStep.tsx`) continues to pass them harmlessly.

Verification gating (`mem://logic/verification-gating`) still passes because `na` is treated as non-blocking.

## Point 2 — Bank cheque failure → manual entry popup

Refactor `src/components/vendor/kyc/BankKycTab.tsx`:

- **Remove the Tabs UI** ("Enter manually" / "Upload cheque"). Show only the cheque uploader (`OcrUploadAndVerify`) plus the existing alert banner (reworded: "Upload your cancelled cheque. If we can't read it, you can enter the details manually.").
- **Detect failure** inside `handleOcrVerify` (and the OCR step itself via `runBankOcr`). Whenever OCR fails, IFSC/account can't be parsed, or the penny-drop API returns `!ok`, set `manualPopupOpen = true` and stash any partial values (`prefillAccount`, `prefillIfsc`).
- **Add an `AlertDialog`** with title "Bank verification failed — enter details manually", body containing two `Input`s (Account Number, IFSC, uppercase, max 11) and a Submit button (disabled until `account.length >= 8 && isValidIfsc(ifsc)`).
- **Submit handler** calls `callProvider({ providerName: 'BANK', input: { account, ifsc, id_number: account } })`, then runs the existing `finalizePennyDrop(account, ifsc, data)` to populate bank name / branch / holder name and trigger GST/PAN name match. On success the popup closes and the green "Account Holder Name verified…" banner appears; on failure an inline error stays inside the popup so the user can correct and retry.
- The shared `finalizePennyDrop` helper (already extracted) is reused unchanged, so the response data flows into the same parent fields as the cheque path (`onBankDetailsChange`, `onVerifiedDetails`, `onStatusChange`).
- Remove now-unused imports: `Tabs*`, `Pencil`, `VerifyButton`, `ValidationMessage`, `useProviderVerify`, the standalone `FileUpload` inside the manual tab, `manualState`/`manualVerify` hook usage.

## Files touched

- `src/components/vendor/kyc/MsmeKycTab.tsx`
- `src/components/vendor/kyc/BankKycTab.tsx`

## Out of scope

- No backend / edge function / RLS changes.
- No changes to GST tab or other KYC tabs.
- Cheque file is still optional/required per existing parent rules — popup path doesn't require a file.

## Verification

1. MSME tab → select **No** → only the Yes/No row remains; no template, reason, or upload field. Step is non-blocking.
2. Bank tab → upload an unreadable cheque (or one whose penny-drop fails) → popup appears with Account + IFSC inputs.
3. Enter valid account + IFSC, click **Submit** → penny-drop runs, popup closes, bank fields and "Account Holder Name verified with …" banner populate exactly as the OCR-success flow.
4. Enter invalid details → inline error inside the popup, user can retry without losing context.
