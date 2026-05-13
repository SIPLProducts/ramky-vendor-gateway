## Problem

The "Download Self-Declaration Template" buttons in the **Non-GST** and **Non-MSME** sections currently link to HTML files (`/templates/gst-self-declaration.html`, `/templates/msme-self-declaration.html`). These open in the browser, not in Word, so vendors can't edit them like a normal document. After printing back to PDF/image and uploading, the experience is awkward.

The upload pipeline (`src/lib/pdfToImage.ts → normalizeUploadToImage`) already supports DOCX, PDF, PNG, JPG, JPEG, WebP, etc., and the upload control accepts `.pdf,.jpg,.jpeg,.png,.doc,.docx`. So the only missing piece is the download format.

## Fix

Switch the two declaration templates to real **.docx** files so vendors can:

1. Click **Download Self-Declaration Template** and get a Word document.
2. Open it in Word / Google Docs / mobile Word, fill in entity name / PAN / address / reason, sign, save.
3. Re-upload the filled file (DOCX, PDF, or scanned PNG/JPG/JPEG) — all already handled by `normalizeUploadToImage`, which converts the upload to a single JPEG before OCR/verification.

### Files to add
- `public/templates/gst-self-declaration.docx`
- `public/templates/msme-self-declaration.docx`

Generated with the `docx` npm skill (Arial body, bold field labels, dotted-line entry rows for Name of Entity / PAN / Constitution / Registered Address / Reason, the same declaration paragraphs and signature block as today's HTML).

### Files to edit
- `src/components/vendor/kyc/GstKycTab.tsx` — change the download link to `/templates/gst-self-declaration.docx` and update the button label to "Download GST Self-Declaration Template (Word)".
- `src/components/vendor/kyc/MsmeKycTab.tsx` — same change for the MSME template (`/templates/msme-self-declaration.docx`).
- (Optional) `src/components/admin/KycLiveTestPanel.tsx` if it links to the templates — verify and update if needed.

### Files to delete (after switch)
- `public/templates/gst-self-declaration.html`
- `public/templates/msme-self-declaration.html`

## Out of scope

- No change to upload handling — DOCX is already converted to JPEG by `normalizeUploadToImage` and passed to the existing OCR/validation flow exactly like PNG/JPG.
- No change to KYC validation logic, edge functions, or registration flow.
- Not pre-filling vendor data into the template (can be a follow-up if you want the entity name / PAN auto-injected at download time).

## Verification

1. Click **Download GST Self-Declaration Template** → file downloads as `.docx`, opens in Word and is fully editable.
2. Same for MSME.
3. Fill, save, upload as DOCX → preview shows the rendered image and verification proceeds as before.
4. Repeat with a printed-and-scanned JPG/PNG → still works (unchanged path).
