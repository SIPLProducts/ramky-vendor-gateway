## Add visible scrollbar to Application Preview dialog body

The `VendorSubmissionPreviewDialog` already wraps content in a `ScrollArea`, but the scrollbar isn't visible/usable in the screenshot — content overflows but no scroll thumb shows. Fix by giving the ScrollArea a fixed bounded height and ensuring the scrollbar renders.

### Change
File: `src/components/vendor/VendorSubmissionPreviewDialog.tsx`

- Set an explicit max height on the `ScrollArea` (e.g. `h-[65vh]`) instead of relying on `flex-1`, so the inner viewport has a constrained height and triggers scrolling.
- Keep right padding so the scrollbar doesn't overlap content.
- No other behavior changes.

That's it — purely a UI/scroll fix in one file.