Update the "All Details" tab in `src/components/vendor/VendorReviewDialog.tsx` to make the verified tick mark much clearer and give every detail card a consistent left accent bar, matching the address-card style we already shipped.

## Scope
- File: `src/components/vendor/VendorReviewDialog.tsx` only.
- No schema / backend / logic changes. No card order changes.
- No changes to the Documents tab or GST Compliance tab.

## 1. Verified tick — Statutory Details
Current: 16px emerald circle with a 1px ring; icon is small and hard to read.
Changes:
- Increase badge size to 20px.
- Make icon a solid white checkmark (strokeWidth 3.5, 12px icon).
- Use a stronger border/ring: `ring-2 ring-emerald-600/40` + soft shadow.
- Keep `title="Verified"` and `aria-label="Verified"`.
- Optional: place badge as a small standalone pill to the right of the label instead of inline, so the text stays aligned.

## 2. Unified card styling — left accent border for all sections
Every section currently rendered as plain heading + grid should be wrapped in the same card style used by the Address section:
- `rounded-xl border border-border/60 bg-gradient-to-br from-background to-muted/40 p-5 shadow-sm`
- `absolute left-0 top-0 h-full w-1.5 bg-primary/80` left accent bar
- Section icon + title moved inside the card header.

Sections to wrap:
- Buyer Details (Routing / Invitation)
- Organization Details
- Statutory Details
- Bank Details
- Address Details (already wrapped; standardize bar width to 1.5 and color to primary/80)
- Classification Details
- Financial Information
- Review Comments

Keep `Separator` between cards for rhythm, or remove where the card boundaries already provide enough separation. Prefer removing inner Separators between wrapped sections to reduce visual noise.

## 3. Verify
- Ensure the dialog still renders all sections without layout breakage.
- Verified badge appears clearly next to GSTIN, PAN, PAN Holder Name, PAN Status, Aadhaar Linked, MSME Number, and MSME Category when their respective validation statuses are `passed`.
- All sections keep the same data fields and read-only behavior.

## Out of scope
- GST Compliance tab
- Documents tab
- Any other files (e.g. VendorSubmissionPreviewDialog, mobile layout, etc.)