# Login Left Panel: Use the Ramky Group Graphic Instead of the Blue Image

Replace the construction/blue hero in the login page's left branding panel with the attached Ramky Group overview graphic (logo, three business circles, Safety-First mascot, CSR wheel). The whole graphic stays visible — nothing is cropped — and the sign-in panel keeps its current width or slightly narrows so the wide graphic has room.

## What changes

1. **New asset** — the uploaded graphic becomes a CDN asset (`src/assets/ramky-group-overview.jpeg.asset.json`) and is imported in `src/pages/Auth.tsx`. The old `src/assets/login-hero-construction.jpg` is no longer referenced and is removed from the repo (recoverable from git history).

2. **Left panel (`src/pages/Auth.tsx`)**:
   - Remove the full-bleed photo, the dark blue gradient overlay, and the white/drop-shadow text.
   - Show the graphic with `object-contain`, centered, with comfortable padding and `max-h` caps so the complete mark — logo, circles, mascot, CSR wheel — is always fully visible at any window size.
   - Panel background becomes a soft light-blue brand surface so the graphic's white background blends in.
   - "Building Tomorrow's Infrastructure Today" headline and the paragraph remain, in dark text below the graphic (no white text, no blue tint).
   - Widen the left panel / narrow the sign-in side so the graphic fits: left `md:w-[58%] lg:w-[60%]`, right `md:w-[42%] lg:w-[40%]` (from the current 55/45). Because the image uses contain-fit, it never gets cut even on smaller windows.

3. **Right panel** — only its width class changes; the sign-in card, mobile layout, logo, and copy are untouched.

## Technical notes

- Files touched: `src/pages/Auth.tsx` only, plus the new asset pointer file and deletion of the unused hero jpg.
- Asset creation via `lovable-assets create --file /mnt/user-uploads/WhatsApp_Image_2026-10-12_at_7.03.43_PM.jpeg --filename ramky-group-overview.jpeg`; the uploaded file itself is never copied into the repo.
- Presentation only — no logic, auth flow, or copy changes.
- Verify by loading `/auth` at desktop width and confirming the full graphic (all three circles plus mascot/wheel) is visible and the headline reads as dark text.
