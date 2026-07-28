Fix the View Details popup so it no longer shows the Primary Buyer field. The current `VendorReviewDialog.tsx` still conditionally renders an extra "Invited By" line for the original buyer when it differs from the current buyer. The user confirmed the original buyer is the same as the current inviter (Sunil), so this field is redundant and should be removed.

## Technical change

- File: `src/components/vendor/VendorReviewDialog.tsx`
- Remove the conditional block at lines 462-467 that renders the original buyer (Primary Buyer) inside the "Buyer Details" section. The block currently reads:

```tsx
{routing.originalBuyerName && routing.originalBuyerName !== routing.buyerName && (
  <div className="space-y-1">
    <p className="text-muted-foreground">Invited By</p>
    <p className="font-medium">{routing.originalBuyerName}</p>
  </div>
)}
```

After removal, the "Buyer Details" section will only show "Buyer Company" and "Invited By".

## Out of scope

- No other labels, tabs, or data loading changes.
- `originalBuyerName` and `originalBuyerEmail` can remain in the `routing` state object for future use; only the UI rendering is hidden.
