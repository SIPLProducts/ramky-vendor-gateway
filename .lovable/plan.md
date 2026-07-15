## Problem

After closing the Document Preview dialog (View button in Documents tab), a brief "Preview not available for this file type / Open in New Tab" popup flashes on screen.

**Cause:** In `src/components/vendor/VendorDocuments.tsx`, the Dialog's `onOpenChange` clears `previewUrl` and `previewDoc` immediately, but the DialogContent stays mounted during its close animation. With `previewDoc` now `null`, the render falls through the image/pdf checks into the "Preview not available" fallback branch, showing the "Open in New Tab" block for a frame before the dialog fully unmounts.

## Fix

Edit `src/components/vendor/VendorDocuments.tsx` (around lines 283–323):

1. Guard the DialogContent body so nothing renders while closing — only render the preview branches when both `previewDoc` and `previewUrl` are truthy. This eliminates the fallback flash entirely.
2. Also update `onOpenChange` to only run the cleanup when `open === false`, so it doesn't fire spuriously.

No other files, no logic/behavior changes beyond removing the visual blink.
