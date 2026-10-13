# Login page: graphic fills the left panel, headline and description removed

## What changes

On the sign-in screen (`/auth`), the left branding panel becomes a clean white surface holding the Ramky Group overview graphic at its full available size, with no crop.

- The graphic is scaled up to span the whole left panel — edge to edge horizontally and vertically centred — instead of sitting as a small framed picture in the middle.
- Because the graphic's own background is white and the panel becomes white, the picture reads as filling the panel: no visible box, no grey bands, no border line around it.
- Nothing is cut off. The three business circles, the mascot, the CSR wheel and every text banner stay fully visible.
- The headline "Building Tomorrow's Infrastructure Today" and the paragraph beneath it are removed.
- The right-hand sign-in panel keeps its current width (40-42%), so the sign-in card, email and password fields, forgot-password link, support email and copyright line all stay exactly as they are.
- Mobile and tablet layout is untouched: on small screens the left panel is already hidden and only the logo plus the sign-in card show.

## What does not change

No database, no functions, no routing, no authentication behaviour. This is presentation only, so no production configuration or backend setting is touched. For the self-hosted server this is a frontend-only update: rebuild the `dist` folder, copy it in place, then reload the web server — no migrations and no function sync needed.

## Technical details

Single file: `src/pages/Auth.tsx`.

1. Left panel container — drop the gradient, padding and vertical gap, keep the same widths (`md:w-[58%] lg:w-[60%]`), switch the background to plain white, and centre its content.
2. Graphic — change from a width-capped, height-capped inline image (`max-w-2xl`, `max-h-[55vh]`, `object-contain`) to an absolutely positioned image covering the panel (`absolute inset-0 h-full w-full object-contain`) so it scales to the panel while preserving the 4:3 ratio.
3. Delete the heading and description block below the graphic.
4. Right panel, top-right logo, mobile logo, card and footer markup are left byte-for-byte unchanged.

The graphic file `src/assets/ramky-group-overview.jpeg` (1448x1086) stays as a bundled import so the local preview and the self-hosted Nginx build both serve it — no CDN asset involved.

## Verification

- Build and type check pass with no new errors.
- Browser screenshots at 1280x800 and 1536x900 confirm the graphic spans the left panel, no text is clipped, and no heading or paragraph remains.
- Screenshot at 390x844 confirms the mobile sign-in screen still shows the logo and card with no horizontal scrolling.
- Console checked for errors on the auth page.
