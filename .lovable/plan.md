## Problem
In the Vendor Review dialog, the **Documents** tab card sits flush against the `TabsList`, so the active tab's green border and the white document card visually overlap. The earlier tightening (`mt-2`) removed too much vertical space between the tab bar and the tab panel.

## Fix (presentation only, `src/components/vendor/VendorReviewDialog.tsx`)
1. Restore breathing room under the tab bar: change each `TabsContent` from `mt-2` to `mt-4` for the three panels (`details`, `documents`, `gst_compliance`) so the panel content no longer visually collides with the active tab border.
2. For the Documents panel specifically, wrap `VendorDocuments` in a `pt-1` container so the card border does not touch the tab bar even at short viewport heights.

No logic, data, or other screens change.
