## SAP Sync screen — visual fixes

Scope: `src/pages/SAPSync.tsx` only. No logic changes.

1. **Active tab clarity** — Update the three `TabsTrigger`s (SAP Sync / DMS Sync / Duplicate & Closed) so the selected tab is clearly distinguishable: apply a `data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow` treatment (using existing design tokens) so the active tab shows a solid primary-blue fill with white text, while inactive tabs stay on the light surface.

2. **Checkbox styling** — Restyle the row/select-all `Checkbox` components in both the SAP Sync tab (lines ~482, ~525) and DMS Sync tab (line ~657) to render as white background with a black border in the unchecked state (matches the Preview button outline look). Checked state keeps the current primary fill so users still see selection.

3. **Remove Preview button** — Delete the `Preview` action button (lines ~548–550) from the SAP Sync tab row actions. Keep `View Details`, `Prepare & Sync`, and `Duplicate & Close`. Leave `VendorSubmissionPreviewDialog` mount and `previewVendorId` state removal as cleanup so no dead code remains.

Out of scope: any other screen, backend, or approval logic.