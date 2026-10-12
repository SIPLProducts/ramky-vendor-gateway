# Rotate images in View Document

## Requested change
- Add a Rotate icon button to image previews opened through View Document, including Dashboard vendor details.
- Each click turns the image 90° clockwise; four clicks return it to its original orientation.
- Keep the entire image visible after rotation, without covering the filename or controls.
- Reset rotation when another document is opened or the preview is closed.
- Rotation affects viewing only: do not change the uploaded file, saved vendor data, download permissions, or PDF behavior.

## Technical details
- Update the shared `VendorDocuments` image-preview flow with temporary rotation state and a labeled, tooltip-equipped design-system button.
- Fit the rotated image using its natural dimensions and the available preview space so portrait and landscape files remain correctly framed.
- Add focused tests for 90° increments, the four-click reset, and document-change reset.
- Record this task in the roadmap during implementation and retain the completed pagination changes.

## Verification
- Open an accessible saved image through vendor details and verify all four orientations, close/reopen reset, and unchanged downloads.
- Check long filenames and both portrait and landscape images at different preview sizes.
- Confirm the current build remains error-free; report any unavailable saved-image test access explicitly.