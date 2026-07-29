## Problem
On the Vendor Type selection screen (on-behalf flow), the glass card shows a horizontal scrollbar. Cause: the long invited email (`onbehalf+c93e81f9@placeholder.local`) is a single unbreakable token that forces the inner `<p>` to overflow the 260px card. The inner wrapper uses `overflow-auto`, so instead of wrapping, it produces a horizontal scrollbar.

## Fix (presentation only)
In `src/pages/VendorRegistration.tsx` (the vendor-type chooser block around lines 1664–1690):

1. Change the inner container from `overflow-auto` to `overflow-hidden` so the card never scrolls horizontally.
2. On the "Invited Email" paragraph, add `break-all` (and keep it as a block) so the long email wraps within the card width instead of forcing overflow.
3. Constrain the email value with `break-all` / `min-w-0` on its wrapper to guarantee wrapping in all browsers.

No logic, data, or other screens are affected.