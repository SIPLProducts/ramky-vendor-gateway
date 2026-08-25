# Further Increase, Bold, and Center the Navbar Title

## Goal
Make the "Vyapaar Portal" / "Ramky Vyapaar Portal" title in the top navigation bars even more prominent by further increasing the font size, making it bold, and centering it horizontally in the navbar.

## Current state (after previous change)
- `EnterpriseHeader.tsx`: `text-lg font-semibold tracking-wide whitespace-nowrap`
- `Header.tsx`: `text-lg font-bold tracking-wide whitespace-nowrap`
- `PublicHeader.tsx`: `text-lg font-bold tracking-wide whitespace-nowrap`
- `MobileHeader.tsx`: `text-base font-semibold tracking-wide whitespace-nowrap`

All titles are currently left-aligned.

## Changes
1. Increase font size further and make all titles bold:
   - `EnterpriseHeader.tsx`: `text-lg font-semibold` → `text-2xl font-bold`
   - `Header.tsx`: `text-lg font-bold` → `text-2xl font-bold`
   - `PublicHeader.tsx`: `text-lg font-bold` → `text-2xl font-bold`
   - `MobileHeader.tsx`: `text-base font-semibold` → `text-lg font-bold`
2. Center the title in each navbar:
   - Wrap the title in an absolutely centered container (`absolute left-1/2 -translate-x-1/2`) so it sits in the horizontal center regardless of left/right navbar content.
   - Keep the title text itself `whitespace-nowrap` to prevent wrapping.
   - Ensure the title does not overlap with left/right elements on smaller viewports by using `truncate` and a max-width where needed.
3. Mobile-specific handling:
   - In `MobileHeader.tsx`, keep the title centered but account for the hamburger icon on the left and action icons on the right.
   - Use a slightly smaller size (`text-lg`) on mobile to avoid crowding.
4. Preserve existing layout and functionality:
   - Left-side content (hamburger, back links) and right-side content (tenant selector, user menu, logo) remain unchanged.
   - No changes to auth, routing, or business logic.

## Files to modify
- `src/components/layout/EnterpriseHeader.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/PublicHeader.tsx`
- `src/components/layout/MobileHeader.tsx`

## Out of scope
- No sidebar changes.
- No color/theme changes beyond making the title bold and larger.
- No changes to logo positioning or other navbar actions.
