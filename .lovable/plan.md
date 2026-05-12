
# Accept Any File for Non-GST / Non-MSME Declaration Uploads

## Problem

1. The "Unsupported file type" toast fires because the dropzone `accept` is restricted to `.pdf,.jpg,.jpeg,.png` and `normalizeUploadToImage()` throws on anything else.
2. The user wants any uploaded file (PDF, DOCX, image, etc.) normalized to a single JPG/JPEG/PNG before storage.

## Scope

Only the two declaration uploaders in `src/components/vendor/steps/DocumentVerificationStep.tsx`:
- GST Self-Declaration (line ~1657)
- MSME Self-Declaration (line ~1862)

All other uploads remain unchanged.

## Behavior

| Uploaded type | Conversion |
|---|---|
| PNG / JPG / JPEG | Pass through unchanged |
| PDF | Render every page → stitch vertically → single JPEG (already implemented) |
| DOCX | Convert to HTML via `mammoth` → render HTML to canvas via `html2canvas` → single JPEG |
| Anything else | Reject with toast: "Unsupported file type. Please upload PDF, DOCX, or an image." |

A success toast "Converted to image: <name>" fires whenever conversion runs.

## Technical Changes

### `src/lib/pdfToImage.ts` — extend `normalizeUploadToImage`

- Add DOCX branch:
  - Detect by `file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'` or `.docx` extension.
  - `mammoth.convertToHtml({ arrayBuffer })` → HTML string.
  - Append a hidden, fixed-width (e.g. 800px) container with the HTML to `document.body`, white background, basic typography.
  - Use `html2canvas` to snapshot the container into one canvas.
  - Export canvas → JPEG `File` named `<basename>.jpg`.
  - Remove the temp container in `finally`.
- Keep PDF and image branches as today.
- Throw clear error for any other type.

### `DocumentVerificationStep.tsx`

- Update `accept` on both `InlineFilePicker` instances from `.pdf,.jpg,.jpeg,.png` to `.pdf,.jpg,.jpeg,.png,.docx` (and matching MIME types).
- `onPick` handlers already call `normalizeUploadToImage` and toast on error — no change beyond the wider accept list.

### Dependencies

Add: `mammoth`, `html2canvas`.

## Out of Scope

- Legacy `.doc`, `.xls`, `.xlsx`, `.ppt`, `.pptx` (would require server-side LibreOffice).
- Changing any other upload field, validation flow, or KYC logic.
