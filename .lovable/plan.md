## Problem
Current TabsList makes labels disappear — the `flex-1` triggers with connected-border approach isn't rendering text visibly in the preview. User wants the previous rounded pill-style tabs back but with proper height and clear active/inactive labels.

## Fix

### `src/components/vendor/VendorReviewDialog.tsx`
Revert TabsList to the original clean pill/segmented style with explicit height and explicit inactive text color:

- `TabsList`: `grid w-full grid-cols-3 rounded-xl bg-muted p-1 h-12`
- Each `TabsTrigger`: `h-10 rounded-lg text-sm font-medium text-muted-foreground data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:border data-[state=active]:border-emerald-500 data-[state=active]:shadow-sm`
- TabsContent margins stay `mt-4`.

This restores the previous working look, adds explicit `h-12` on the list and `h-10` on triggers so labels are clearly visible, and keeps the active tab highlighted with a white background + emerald border.

No other changes.

## Verification
Open View Details → three tabs clearly labeled ("All Details", "Documents", "GST Compliance Report"), active tab shows white background with emerald border and text, inactive tabs show muted grey text on the muted bar.
