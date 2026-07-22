Plan: Update the main navigation bars across the application to use a taller white header with black text and a larger, clearer Ramky logo, while preserving responsiveness and functionality.

Files to edit:
- `src/components/layout/Header.tsx` (main app header)
- `src/components/layout/PublicHeader.tsx` (public/unauthenticated header)
- `src/components/layout/MobileHeader.tsx` (mobile app header)
- `src/pages/VendorRegistration.tsx` (vendor registration flow headers)
- `src/pages/VendorLogin.tsx` (vendor login header)
- `src/pages/VendorInviteAccept.tsx` (vendor invite accept header)
- `src/pages/VendorInviteCallback.tsx` (vendor invite callback header)

Changes:
1. Increase navbar height
   - Desktop/main headers: change from `h-14` to `h-16` or `h-18` (e.g., `h-16` for a balanced, professional look).
   - Mobile header: change from `h-14` to `h-16` to match.
   - Adjust internal padding and element sizes so the logo, icons, and buttons stay vertically centered.

2. Set background color to white
   - Replace `bg-card/80`, `bg-card`, `bg-background`, `bg-slate-950/60`, and `bg-white/80` with `bg-white` on the header element.
   - Keep the bottom border (`border-b`) for separation; adjust to a light border such as `border-border` or `border-gray-200` if needed.

3. Change navigation text to black
   - Replace `text-foreground` and `text-white` text colors on the header title/brand with `text-black` or `text-slate-950`.
   - Keep other header controls (icons, dropdown items, notification badges) using their existing semantic colors so they remain readable.

4. Replace the small gradient "R" icon with the actual Ramky logo and increase its size
   - In `Header.tsx` and `PublicHeader.tsx`, replace the `h-9 w-9` gradient "R" icon block with the `ramkyLogo` image, set to a larger size such as `h-10 w-auto` or `h-12 w-auto`.
   - In `MobileHeader.tsx`, increase the logo from `h-9 w-9` to `h-11 w-auto` or `h-12 w-auto`.
   - In vendor-facing pages, increase the logo from `h-8 w-auto` to `h-10 w-auto` or `h-12 w-auto`.
   - Ensure `object-contain` is used on the image so the logo scales without distortion.

5. Ensure responsiveness
   - Keep the existing flex layout, sticky positioning, and mobile/desktop breakpoints.
   - Make sure the larger logo and height do not break the mobile menu toggle or tenant switcher spacing.
   - Keep text truncation and hiding utilities (`hidden sm:block`, `truncate`) intact.

6. No functionality changes
   - Do not alter routing, auth logic, sign-out handlers, notification badges, tenant switcher, or any business logic.
   - Only update visual styles and logo sizing.
