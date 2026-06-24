## Issue
On the **All Vendors** screen (`src/pages/VendorList.tsx`), rows with status `returned_to_buyer` render two action buttons — **Edit & Resubmit** and **Return to Vendor**. These actions belong to the Buyer Approval workflow (and are already available on the Buyer Approval screen), not to the read-only All Vendors listing.

## Fix
In `src/pages/VendorList.tsx`, remove the `returned_to_buyer` conditional block (lines ~466–499) from the Actions cell. The Actions column will keep only the View (eye) button for every row, regardless of status.

No other files change. The Buyer Approval screen retains its own Edit & Resubmit / Return to Vendor controls.