## Change

Remove the **Approval Timeline** card from the SAP Review / View popup (`VendorReviewDialog.tsx`). This is the only place this card appears in view-button popups.

The login/auth page (`/auth`) stays exactly as shown in the screenshot — no changes.

## File

- `src/components/vendor/VendorReviewDialog.tsx` — delete the Approval Timeline block starting around line 632 (the card containing "Finance Reviewed At" / "Purchase Reviewed At").

No other screens or logic change.