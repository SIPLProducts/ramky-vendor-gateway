# Vypaar Portal Rebrand & UI Refresh

Uses the attached Ramky Group logo ("Towards sustainable growth") as the new brand mark and background watermark.

## 1. Logo asset
- Upload the attached logo to CDN assets and reference it as the single brand image across the app.
- Keep the existing logo file only where it is still needed; all headers and login switch to the new one.
- Update the favicon from the same logo.

## 2. Login page (`/auth`, `/vendor/login`)
- Move the logo to the top-right corner of the page.
- Replace the current construction hero photo with the Ramky logo treatment as the page background (large, centered, soft/low-opacity watermark on a light surface) so the sign-in card stays fully readable.
- Support email: `vendxsupport@ramky.com` → `vypaarsupport@ramky.com`.

## 3. Navigation bars
Applies to the app header, mobile header, public header and the vendor registration header:
- Logo moves to the right side of the bar; the title/nav items sit on the left.
- Text "Vendor Portal" → "Vypaar Portal" everywhere (headers, page titles, browser tab title, meta description, manifest).

## 4. Vendor type selection / main body
- Remove the flag/3D icons shown for the selected vendor type (Domestic / International cards keep text and selected state only).
- Replace the blue background image with the Ramky logo watermark background.
- Apply that same watermark background to the whole main body/content area of the registration screens, not just the vendor type block.

## 5. Emails & support address
- Replace `vendxsupport@ramky.com` with `vypaarsupport@ramky.com` in every email template and edge function (invitations, status notifications, approvals, password reset, submission notices, SMTP test) plus the in-app Support/Help pages and config defaults.
- Update "Vendor Portal" wording to "Vypaar Portal" in email subjects and bodies.

## Technical notes
- Files touched: `src/pages/Auth.tsx`, `src/pages/VendorLogin.tsx`, `src/pages/ResetPassword.tsx`, `src/pages/VendorInviteAccept.tsx`, `src/pages/VendorInviteCallback.tsx`, `src/pages/Index.tsx`, `src/pages/Landing.tsx`, `src/pages/SupportHelp.tsx`, `src/pages/VendorRegistration.tsx`, `src/pages/AdminConfiguration.tsx`, `src/pages/EmailConfiguration.tsx`, `src/components/layout/*Header.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/vendor/steps/international/VendorTypeSelector.tsx`, `src/components/vendor/SubmissionSuccessDialog.tsx`, `src/components/admin/NoReplyEmailConfig.tsx`, `index.html`, `public/manifest.webmanifest`, and the `supabase/functions/*` email senders.
- Background watermark implemented as a reusable CSS utility/token in `index.css` (fixed, centered, contain, low opacity) so all screens share one definition.
- No changes to business logic, validation, workflow, or data — presentation and copy only.
