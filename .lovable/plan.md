# Fix: scroll bar still missing in SAP Field Confirmation popup

New hypothesis: Radix `ScrollArea` doesn't get a measurable height inside the flex `DialogContent` (which itself uses `max-h-[90vh]`), so its viewport stays auto-sized and never overflows. Replacing it with a plain native scrolling `<div>` with an explicit `maxHeight` removes the dependency on Radix measuring its parent.

## Changes in `src/components/sap/SapFieldsDialog.tsx`

1. Remove `import { ScrollArea } from '@/components/ui/scroll-area';`
2. Replace line 61:
   ```tsx
   <ScrollArea className="flex-1 min-h-0 max-h-[60vh] pr-4">
   ```
   with:
   ```tsx
   <div className="flex-1 min-h-0 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 220px)' }}>
   ```
3. Replace its closing `</ScrollArea>` with `</div>`.

This forces a real scroll container so the user can scroll to Sort Key, Planning Group, Purchase Data and Classification sections.
