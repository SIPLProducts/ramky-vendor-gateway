## Remaining blink

Even after guarding the inner body, the Radix Dialog still plays its close/fade-out animation on the outer `DialogContent` + overlay when the preview is dismissed, which produces the residual blink the user is still seeing.

## Fix

In `src/components/vendor/VendorDocuments.tsx` (Document Preview Dialog block, ~lines 283–326):

- Only mount `<DialogContent>` when `previewDoc && previewUrl` are both truthy. When the user closes the preview, state clears immediately and the entire DialogContent + overlay unmounts in the same tick, skipping the fade-out animation that causes the blink.
- Keep the existing `onOpenChange` cleanup (revoke blob URL, clear state on close).
- No other files change; no logic changes to fetching/downloading.
