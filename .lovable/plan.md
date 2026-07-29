## Vendor Review Dialog – Tab Body Spacing & Background

Small visual polish for the tab panels inside `src/components/vendor/VendorReviewDialog.tsx`.

### Changes
1. **Gap between tab bar and body**
   - Reduce/standardize the top spacing on every `TabsContent` panel to a tight `6px` gap (`mt-1.5`) instead of the current `mt-4`, so the body sits just below the tab strip as requested (5–7px).

2. **White card background for tab body**
   - Wrap each `TabsContent` panel's inner content in a white card container (`bg-white rounded-lg border border-border p-4`) so the active tab's body clearly reads as a white card against the dialog's grey backdrop.
   - Applies to all tabs: All Details, Documents, GST Compliance, Approval History, Comments.

### Out of scope
- No changes to tab pill styling itself (kept as previously restored).
- No changes to dialog header/footer or business logic.
