# Fix: Active KYC tab not visually highlighted

## Problem
On the Document Verification step, when the user moves to a tab like **2. PAN**, the tab does not look "selected". As shown in the screenshot, all four tabs (GST, PAN, MSME, Bank) appear visually identical — there is no clear active highlight, only a tiny status icon difference.

Root cause is in `src/components/vendor/steps/DocumentVerificationStep.tsx` (lines 1128–1160):

- `TabsList` uses `bg-muted/60` (very light grey).
- `TabsTrigger` only sets `data-[state=active]:bg-background data-[state=active]:shadow-enterprise-sm`.
- `bg-background` is white and `bg-muted/60` is near-white, so the active pill is barely distinguishable. There is no border, no primary color, no text emphasis, and no number-badge differentiation.

## Fix

Update only the tab-trigger / tab-list styling in `DocumentVerificationStep.tsx`. No logic changes.

1. **Tab list container** — keep the soft grey track but tighten contrast:
   - Replace `bg-muted/60` with `bg-muted` and add `border border-border rounded-lg`.

2. **Tab trigger (active state)** — make selection unmistakable, SAP Fiori style:
   - White background (`bg-background`)
   - Primary-colored bottom accent + ring: `ring-1 ring-primary/30`
   - Text turns primary and bold: `data-[state=active]:text-primary data-[state=active]:font-semibold`
   - Stronger shadow: `shadow-enterprise-sm`
   - Slight scale/elevation feel via `rounded-md`

3. **Tab trigger (inactive state)** — muted text so the contrast with active is obvious:
   - `text-muted-foreground hover:text-foreground hover:bg-background/60`

4. **Step number chip** — render the "1.", "2.", "3.", "4." as a small circular badge that turns primary-filled when active, grey when inactive. This gives a second visual cue that matches the existing step-indicator language used elsewhere in registration.

5. **Disabled (locked) tabs** — keep them visibly de-emphasized: `opacity-50 cursor-not-allowed` and a small lock icon (already present via `StatusChip locked`).

6. **Mobile** — keep `grid-cols-4`; reduce horizontal padding on the trigger so the number badge + label + status chip fit on narrow widths without wrapping.

## Files to change

- `src/components/vendor/steps/DocumentVerificationStep.tsx` (only the `TabsList` + `TabsTrigger` block around lines 1128–1160, plus a tiny inline `StepNumberBadge` helper just above it).

No other components, hooks, edge functions, or DB changes are needed. The PDF→image OCR pipeline already in place is untouched.

## Visual outcome

```text
Before:  [ 1. GST ✓ ] [ 2. PAN ⏱ ] [ 3. MSME 🔒 ] [ 4. Bank ✓ ]   <- all look the same
After:   [ 1 GST ✓ ] [▌2 PAN ⏱▐] [ 3 MSME 🔒 ] [ 4 Bank ✓ ]
                       ^ white card, primary ring, primary bold text, lifted shadow
```
