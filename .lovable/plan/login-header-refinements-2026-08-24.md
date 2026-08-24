# Login & Header Refinements

## 1. Login page (`/auth`)
- Left panel copy becomes:
  - Headline: "Building Tomorrow's Infrastructure Today"
  - Body: "Join our network of trusted vendors and partners. Streamline your onboarding process with our secure, efficient portal."
  - Remove "Towards sustainable growth" and "Streamlined vendor onboarding, KYC management, and procurement collaboration for the Ramky Group."
  - Keep the Ramky logo on the left panel.
- Add a second Ramky logo fixed in the top-right corner of the page (so logo appears both left panel and top right).
- Logo shown on a clean white rounded tile so the JPEG's greyish background does not show.

## 2. Sidebar (after login)
- Remove the "Vypaar Portal" title block at the top of the sidebar; navigation starts directly.

## 3. Top navigation bar
- "Vypaar Portal" title moves to the far left of the bar.
- Right side order: tenant/company selector, logout icon, then the Ramky logo at the very end.
- Logo rendered inside a white rounded container (small padding) so it looks clean against the header, removing the grey tint.
- Same treatment applied to the mobile header and public header for consistency.

## Technical notes
- Files: `src/pages/Auth.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/EnterpriseHeader.tsx`, `src/components/layout/Header.tsx`, `src/components/layout/MobileHeader.tsx`, `src/components/layout/PublicHeader.tsx`.
- Presentation only: no changes to auth logic, permissions, or routing.
