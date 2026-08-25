# Vendor Registration Navbar Alignment

## Goal
Make “Vyapaar Portal” in Vendor Registration match the post-login navbar: clearly visible, bold, larger, positioned on the left, with consistent left margin.

## Changes
- Update the active Vendor Registration form header shown in the screenshot.
- Apply the same title styling and left spacing to the registration type-selection and submitted-state headers so the position does not change between registration screens.
- Keep save status, Help, Feedback, and the Ramky logo aligned on the right.
- Preserve the compact mobile layout and prevent the title from colliding with right-side controls.

## Technical Details
- Modify the inline header markup in `VendorRegistration.tsx`; this route does not render the shared `PublicHeader` component.
- Reuse the established desktop title treatment (`text-2xl`, bold, left-aligned spacing) with a smaller responsive mobile size.
- Verify the registration route visually at desktop width and confirm the build succeeds.
