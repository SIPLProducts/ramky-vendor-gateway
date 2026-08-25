# Move "Vyapaar Portal" title to the left in all headers

## Goal
Shift the "Vyapaar Portal" / "Ramky Vyapaar Portal" title from the center to the left side of every top navigation bar, with a small left margin/padding so it sits slightly inset from the edge. Keep tenant selector, logout/user menu, and logo grouped on the right.

## Current state
All four header components currently use a three-column flex layout:
- Left: empty spacer (desktop) or hamburger menu (mobile)
- Center: "Vyapaar Portal" / "Ramky Vyapaar Portal" title
- Right: tenant selector, logout/user actions, Ramky logo

## Changes
1. **EnterpriseHeader.tsx**
   - Move the title `<Link>` block to the left side of the header.
   - Add a small left margin to the title (e.g., `ml-2` or `ml-4`) so it is not flush against the edge.
   - Keep the right-side group (tenant picker, logout, logo) aligned to the end.

2. **Header.tsx**
   - Move the `<h1>` title to the left side.
   - Add a small left margin to the title.
   - Keep the right-side group (notifications, user dropdown, logo) aligned to the end.
   - Update title text from "Ramky Vyapaar Portal" to "Vyapaar Portal" for consistency.

3. **PublicHeader.tsx**
   - Move the `<h1>` title to the left side.
   - Add a small left margin to the title.
   - Keep the right-side group (Help, Feedback, logo) aligned to the end.
   - Update title text from "Ramky Vyapaar Portal" to "Vyapaar Portal" for consistency.

4. **MobileHeader.tsx**
   - Move the title `<Link>` to the left, next to the hamburger menu.
   - Add a small left margin to the title.
   - Keep the right-side group (tenant select, notifications, avatar/logout, logo) aligned to the end.
   - Maintain truncation and font styling.

## Styling rules
- Preserve current font size (`text-2xl` desktop, `text-lg` mobile), `font-bold`, `tracking-wide`, and `whitespace-nowrap`.
- Add a left margin of `ml-4` (1rem / 16px) to the title for a clean inset from the navbar edge.
- Keep the existing background, border, height, and shadow classes unchanged.
- Ensure the title does not overlap the hamburger on mobile by using appropriate gap/spacing.

## Verification
- Build the app and confirm no compilation errors.
- Check desktop dashboard header renders title on the left with visible left margin and actions on the right.
- Check mobile header renders title on the left without truncation issues.
