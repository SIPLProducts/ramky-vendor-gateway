# Make "Vyapaar Portal" Navbar Title More Visible

## Goal
Increase the font size and visual prominence of the portal title text that appears in the top navigation bars, so "Vyapaar Portal" is clearly visible.

## Current state
- `EnterpriseHeader.tsx`: title is `text-sm font-semibold`.
- `Header.tsx`: title is `text-base font-bold` as "Ramky Vyapaar Portal".
- `PublicHeader.tsx`: title is `text-base font-bold` as "Ramky Vyapaar Portal".
- `MobileHeader.tsx`: title is `text-sm font-semibold` and also truncated.

## Changes
1. Increase the title font size in all four headers:
   - `EnterpriseHeader.tsx`: `text-sm` → `text-lg` (or `text-base` if space is tight), keep `font-semibold`.
   - `Header.tsx`: `text-base` → `text-lg`, keep `font-bold`.
   - `PublicHeader.tsx`: `text-base` → `text-lg`, keep `font-bold`.
   - `MobileHeader.tsx`: `text-sm` → `text-base` (limited by mobile width), keep `font-semibold` and `truncate`.
2. Improve visibility:
   - Use `text-foreground` (already set) for strong contrast.
   - Add a slight letter-spacing (`tracking-wide`) to the title for readability.
   - Ensure the title container does not wrap; keep `whitespace-nowrap` where needed.
3. Preserve layout:
   - Keep the title on the far left of the bar.
   - Keep the tenant selector, logout/avatar, and logo on the right.
   - Do not change logo positioning or any functional behavior.

## Files to modify
- `src/components/layout/EnterpriseHeader.tsx`
- `src/components/layout/Header.tsx`
- `src/components/layout/PublicHeader.tsx`
- `src/components/layout/MobileHeader.tsx`

## Out of scope
- No changes to sidebar navigation.
- No changes to auth, routing, or business logic.
- No color theme changes beyond text visibility.
