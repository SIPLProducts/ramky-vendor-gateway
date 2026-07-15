Update `src/components/vendor/VendorReviewDialog.tsx` only.

### Statutory Details card
Keep the 3-column grid. Reorder and remove fields as follows:
- Row 1: GSTIN, PAN, PAN Holder Name
- Row 2: PAN Status, Is Aadhaar Linked
- Row 3: MSME Number, MSME Category, MSME Major Activity

Remove `Firm Registration No` and `IEC No` fields.
Add `MSME Major Activity` field using value `v.msme_major_activity`.

### Address Details card — VisitingCard contacts block
Change the contacts layout from the current inline 2-column grid to a stacked 2×2 grid with label below the value:
- Row 1: Email 1 | Contact 1
- Row 2: Email 2 | Contact 2

Each cell must show the value first, then the muted label below it.
Email columns get more width (flexible), contact columns get fixed width sized for ~10 digits.
Always render all four slots and show `-` when a value is empty so the 2×2 alignment stays consistent.

No schema, backend, or other files required.
