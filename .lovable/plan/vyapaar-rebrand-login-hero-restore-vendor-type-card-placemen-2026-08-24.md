# Vyapaar Rebrand, Login Hero Restore, Vendor Type Card Placement

## 1. Spelling fix: Vypaar -> Vyapaar
Replace every occurrence of "Vypaar" with "Vyapaar" across the app:
- UI: headers (app, mobile, enterprise, public, registration), sidebar, page titles, login/invite/reset pages, admin & email configuration screens.
- Metadata: `index.html` title/meta/og tags, `public/manifest.webmanifest`.
- Emails and edge functions: invitation, status notification, approval, submission, password reset, SMTP test subjects and bodies.
- Support address: `vypaarsupport@ramky.com` -> `vyapaarsupport@ramky.com` everywhere (UI, emails, config defaults).

Note: the new mailbox `vyapaarsupport@ramky.com` must exist on the mail server, otherwise replies/bounces will fail.

## 2. Login page left panel — back to the hero photo
- Generate a construction-site-at-sunset photo (cranes, structure under construction, workers) and store it as a project asset.
- Left panel uses that photo full-bleed with a blue gradient overlay, matching the reference screenshot.
- Headline "Building Tomorrow's Infrastructure Today" and the paragraph stay, rendered in white over the photo.
- Remove the Ramky logo from the left panel entirely: no logo tile, no watermark.
- The top-right corner logo on the page stays as-is.

## 3. Vendor Registration — Select Vendor Type card
- Move the card from the horizontal centre to the right side of the content area, kept vertically centred.
- Keep the current size, orange border, translucent styling and Continue button unchanged.

## Technical notes
- Files: `src/pages/Auth.tsx`, `src/pages/VendorRegistration.tsx`, header/layout components, `index.html`, `public/manifest.webmanifest`, and the `supabase/functions/*` email senders.
- Hero image generated into `src/assets/` and imported as an ES module image.
- Presentation and copy only — no logic, workflow, or data changes.
