# Plan: Self-declaration upload error & Bank manual fallback

## Point 1 — Fix "mime type … wordprocessingml.document is not supported"

**Root cause:** The `vendor-documents` storage bucket only allows `application/pdf`, `image/jpeg`, `image/png`, `image/jpg`. The MSME (and GST) self-declaration template is an HTML file the user fills/saves — many users save it as **.docx** from Word, which the bucket rejects.

**Fix (migration):** Extend `storage.buckets.allowed_mime_types` for `vendor-documents` to also accept:
- `application/msword` (.doc)
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx)
- `text/html` (.html — the template itself)

**Fix (UI):** Update the self-declaration `FileUpload` `accept` props in:
- `MsmeKycTab.tsx` (signed MSME self-declaration)
- The equivalent GST self-declaration upload (in `GstKycTab.tsx`)

from `.pdf,.jpg,.jpeg,.png` → `.pdf,.jpg,.jpeg,.png,.doc,.docx`.

Other document fields (PAN card, cheque, GST cert, MSME cert) keep the existing PDF/image-only accept list, since OCR only handles those.

## Point 2 — Manual entry fallback on the Bank tab

Today `BankKycTab.tsx` only supports the OCR cheque flow (manual entry is explicitly disabled per the alert). When OCR fails or the cheque is unreadable, the vendor is stuck.

**Add a tab switcher (mirroring MSME/PAN/GST):**

```text
[ Enter manually ]   [ Upload cancelled cheque ]
```

- **Manual mode**: Two inputs — Account Number, IFSC (uppercase, 11-char). A single **Verify** button calls the same configured `BANK` provider (penny-drop) via `useConfiguredKycApi.callProvider({ providerName: 'BANK', input: { account, ifsc, id_number: account } })`. On success it runs the same IFSC enrichment + GST/PAN name match logic already in `handleVerify`. The cancelled-cheque file becomes optional in this mode (still recommended; vendor may upload a passbook/statement PDF as supporting proof).
- **Upload mode**: unchanged (existing OCR + verify flow).

**Refactor:** Extract the post-verification logic in `handleVerify` (IFSC lookup, name match, status updates, `onBankDetailsChange`) into a shared `runBankPennyDrop(account, ifsc)` helper used by both modes.

**UI alert** updated: "Upload a cancelled cheque to auto-read account & IFSC, or switch to manual entry if OCR fails — both flows verify via penny-drop."

## Files touched

- `supabase/migrations/<new>.sql` — update `vendor-documents` bucket allowed_mime_types
- `src/components/vendor/kyc/MsmeKycTab.tsx` — broaden self-declaration accept
- `src/components/vendor/kyc/GstKycTab.tsx` — broaden self-declaration accept
- `src/components/vendor/kyc/BankKycTab.tsx` — add manual/upload tabs, extract helper

## Out of scope

- No changes to OCR providers, penny-drop edge function, or KYC API config screens.
- No name-match logic changes.
- No backend RLS changes.

## Verification

1. Re-upload the .docx MSME self-declaration → save succeeds, no mime error toast.
2. On Bank tab, switch to **Enter manually** → type a valid account + IFSC → click Verify → see the same green "Account Holder Name verified with …" banner as the OCR flow.
3. Upload-cheque flow still works unchanged.
