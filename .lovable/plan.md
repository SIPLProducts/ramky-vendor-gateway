# Fix scroll in SAP Field Confirmation dialog

The dialog body cuts off lower fields (Sort Key, Planning Group, Purchase Data, Classification) because the inner `ScrollArea` has `flex-1` without a bounded height, so it never overflows.

## Change

`src/components/sap/SapFieldsDialog.tsx` line 61 — give the ScrollArea a real max height and `min-h-0` so flex layout lets it scroll:

```tsx
<ScrollArea className="flex-1 min-h-0 max-h-[60vh] pr-4">
```

That single change makes the card scrollable and reveals all sections below.
