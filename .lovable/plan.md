# Center Navbar Title Between Left and Right Content

## Goal
Fix the "Vyapaar Portal" title so it is visually centered between the left and right content groups in the navbar, rather than appearing slightly off-center.

## Current state
The title is absolutely positioned with `left-1/2 -translate-x-1/2`, which centers it in the full header width. Because the left and right content groups have different widths (e.g., hamburger vs. tenant selector + logout + logo), the title can look a few pixels off from the true visual center between those groups.

## Changes
1. Refactor each header to use a three-column flex layout:
   - Left column: `flex-1 flex items-center justify-start` — holds left-side content (hamburger, back links).
   - Center column: `flex-none flex items-center justify-center` — holds the centered title.
   - Right column: `flex-1 flex items-center justify-end` — holds right-side content (tenant selector, user menu, logout, logo).
2. Apply to all four headers:
   - `EnterpriseHeader.tsx`
   - `Header.tsx`
   - `PublicHeader.tsx`
   - `MobileHeader.tsx`
3. Keep the existing title styling (`text-2xl font-bold tracking-wide whitespace-nowrap` on desktop, `text-lg font-bold` on mobile).
4. Ensure the title remains a clickable Link where it currently is one.
5. Preserve all existing navbar functionality and element order.

## Files to modify
- `src/components/layout/EnterpriseHeader.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/PublicHeader.tsx`
- `src/components/layout/MobileHeader.tsx`

## Out of scope
- No font size or color changes beyond the centering fix.
- No changes to sidebar, auth, routing, or business logic.
