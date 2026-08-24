# Login Page Left Panel — Match Reference

Right side (sign-in card, footer, support email) stays exactly as it is today. Only the left panel and the logo treatment change.

## 1. Transparent logo
The current logo file has a grey/white box baked into the JPG, which is why it shows as a grey tile on any background. Produce a background-removed PNG version of the Ramky logo and use it everywhere the logo appears (login page, all headers), so it sits cleanly on any surface.

## 2. Page background
- Replace the flat grey split with a soft light gradient across the whole page (pale blue-white, as in the reference).
- Add a large, very faint Ramky watermark on the lower-left of the left panel, partly cropped by the edge, behind the text.
- Remove the separate `bg-muted/40` block so the left and right sides share one continuous background; the sign-in card floats on it.

## 3. Left panel content
- Drop the large centered logo block.
- Left-align the content: heading "Building Tomorrow's Infrastructure Today" over two lines, then the paragraph "Join our network of trusted vendors and partners. Streamline your onboarding process with our secure, efficient portal." in a narrow column beneath it.
- Vertically centered, sized in proportion to the card as in the reference.

## 4. Top-right logo
- Keep the logo in the top-right corner, transparent background, at a modest size with the "Towards sustainable growth" tagline visible.

## Technical notes
- Files: `src/pages/Auth.tsx`, `src/index.css` (gradient + watermark utility), new transparent logo asset pointer in `src/assets`, and logo import swap in `Header.tsx`, `EnterpriseHeader.tsx`, `PublicHeader.tsx`, `MobileHeader.tsx`, `VendorRegistration.tsx`.
- Presentation only — no auth logic or copy changes beyond layout.
