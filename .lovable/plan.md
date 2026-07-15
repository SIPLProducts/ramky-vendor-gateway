In `src/components/vendor/VendorReviewDialog.tsx`, update the Address Details contacts block so each cell shows the label first and the value below it:

- Row 1: Email 1 | Contact 1
- Row 2: Email 2 | Contact 2

Each cell format:
```
<span className="text-muted-foreground text-xs">Email 1</span>
<span className="font-medium break-all">{email1 || '-'}</span>
```

Keep the same `grid-cols-[1fr_140px]` layout so email takes the flexible space and contact stays fixed width for 10 digits.

The Statutory Details card already matches the approved row layout:
- Row 1: GSTIN, PAN, PAN Holder Name
- Row 2: PAN Status, Is Aadhaar Linked
- Row 3: MSME Number, MSME Category, MSME Major Activity

No other files changed.