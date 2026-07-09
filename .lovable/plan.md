Update the VendorReviewDialog UI polish based on the Sharvi logo palette and clearer visual cues.

1. Address cards left accent bar
   - Change the accent bar on the Registered / Corporate Office Address and Communication Address visiting cards from the muted `bg-primary/80` to the solid logo green (`bg-emerald-500`).
   - Keep the same 1.5 px width and full-height positioning.

2. Statutory verified tick mark
   - Replace the current ring-heavy verified badge with a simpler 3 px border style.
   - Use a solid emerald-500 fill, a clean 3 px border (white or emerald-700), and a larger, bolder white check icon so the tick is clearly visible.
   - Remove the heavy drop shadow / ring overlay that is making the circle look too busy.

3. Verification scope
   - Apply the updated tick to the existing Statutory Details fields that currently show it (GSTIN, PAN, PAN Holder Name, PAN Status, Aadhaar Linked, MSME Number, MSME Category).

4. Verification
   - Build the project and open the Buyer Approval page preview to confirm the address cards show a crisp green left bar and the statutory verified badge is a clean 3 px bordered circle with a clearly visible check.

File touched: `src/components/vendor/VendorReviewDialog.tsx`.