## Goal

Replace the declaration templates with the three uploaded Word files, and split the GST case into two distinct templates (currently one file serves both "not GST registered" and "GST returns not filed").

## Files to add in `public/templates/`

| Uploaded file | New path | Used for |
|---|---|---|
| 1.Non-GST_Declaration.docx | `non-gst-declaration.docx` | Vendor answers "No" to GST registered |
| 2.Non-MSME_Declaration-2.docx | `non-msme-declaration.docx` | Vendor answers "No" to MSME registered |
| 3.GST_Returns_Declaration-4.docx | `gst-returns-declaration.docx` | GSTR1 not filed / filing status check fails |

Old `gst-self-declaration.docx` and `msme-self-declaration.docx` are removed once no references remain.

## Reference updates

- `src/components/vendor/steps/DocumentVerificationStep.tsx`
  - line ~2465 (GST filing not filed banner) → `gst-returns-declaration.docx`
  - line ~2500 (GST = No path) → `non-gst-declaration.docx`
  - line ~2694 (MSME = No path) → `non-msme-declaration.docx`
- `src/components/vendor/kyc/GstDeclarationDialog.tsx` (GST filing not available dialog) → `gst-returns-declaration.docx`
- `src/components/vendor/kyc/GstKycTab.tsx` (Non-GST declaration) → `non-gst-declaration.docx`

## Technical notes

- The DOCX files are copied into `public/templates/` (they must be real files served by literal path so the `download` links work), not CDN asset pointers.
- No changes to upload document types (`gst_self_declaration`, `msme_self_declaration`) or any backend/schema logic — templates and link targets only.