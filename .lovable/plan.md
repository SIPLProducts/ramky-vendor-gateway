## Cause (verified)

`GET /templates/non-gst-declaration.docx` returns an **empty `Content-Type`** header. With no MIME type, the browser renders the raw bytes as text instead of saving the file. The `target="_blank"` on the links makes this worse — the file opens in a new tab, where the `download` attribute is ignored. That's exactly the garbled `PK...[Content_Types].xml` output in the screenshot.

## Change

1. Add a small helper `src/lib/downloadTemplate.ts`:
   - `downloadTemplate(path, filename)` — `fetch` the file, read it as a Blob, force the DOCX MIME type (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`), create an object URL, click a hidden `<a download={filename}>`, then revoke the URL.
   - On fetch failure, fall back to a plain navigation to the path and show a toast.

2. Replace the five raw anchor links with buttons that call the helper (no `target="_blank"`, no reliance on the server MIME type):
   - `src/components/vendor/steps/DocumentVerificationStep.tsx` — GST Returns Declaration (~2465), Non-GST (~2500), Non-MSME (~2694)
   - `src/components/vendor/kyc/GstDeclarationDialog.tsx` — GST Returns Declaration
   - `src/components/vendor/kyc/GstKycTab.tsx` — Non-GST Declaration

   Keep the existing button/link styling and labels unchanged; only the download mechanism changes.

## Technical notes

- Frontend only. No changes to the DOCX files themselves or to upload/verification logic.
- This also makes downloads work identically in the Lovable preview iframe, on the published app, and on the self-hosted Nginx server, regardless of whether the server sends a MIME type for `.docx`.
- Optional (say if you want it): add an explicit `types { ... docx ... }` MIME mapping to the self-host Nginx config so direct URL hits also serve the right type. Not required once the blob download is in place.