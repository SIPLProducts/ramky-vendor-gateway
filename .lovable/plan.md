Make the logo in the top nav bar more visible by increasing its rendered size on both desktop and mobile, while keeping the layout intact.

1. Desktop top nav (`src/components/layout/EnterpriseHeader.tsx`)
   - Increase the Ramky logo from `h-8 w-auto` to `h-10 w-auto`.
   - Keep the logo `object-contain` and maintain its aspect ratio.
   - Ensure the surrounding header still aligns the logo and text vertically without overflow.

2. Mobile top nav (`src/components/layout/MobileHeader.tsx`)
   - Increase the logo from `h-7 w-7` to `h-9 w-9`.
   - Keep the hamburger button and text label aligned; the label remains hidden if space is tight.

3. Verify the change visually across viewports (desktop and mobile widths) and confirm no other nav bar breaks.

No functional changes. Scope is limited to logo sizing in the two top nav bars.