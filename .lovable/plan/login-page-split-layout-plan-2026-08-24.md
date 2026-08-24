# Login Page Split Layout Plan

## Goal
Redesign the `/auth` login page to use a clean left-right split layout: a branded left panel with the Ramky logo and description, and a right panel with the login form. Remove the existing watermark background from the login page.

## Current state
- `src/pages/Auth.tsx` is a single centered column with the logo at the top-right and a centered form card.
- The `.ramky-brand-bg` watermark utility is applied to the whole page.

## Changes

### 1. `src/pages/Auth.tsx` — split layout
- Replace the single-column wrapper with a full-height `flex` or `grid` layout:
  - **Left panel (desktop ~55% width):** clean background, centered Ramky Group logo, tagline "Towards sustainable growth", and a short welcome/description line.
  - **Right panel (desktop ~45% width):** contains the existing login form card, centered vertically and horizontally.
- Remove the `ramky-brand-bg` watermark class from the login page wrapper.
- Keep the top-right logo block removed (logo now lives on the left panel).
- Preserve all existing form logic, error handling, forgot-password flow, and the `ForgotPasswordDialog`.
- Add responsive behavior: on mobile/tablet, stack the panels vertically (logo/description above the form) or hide the left panel entirely so the form remains usable.

### 2. `src/index.css` — keep utility available
- Leave the `.ramky-brand-bg` utility in place for other screens that still need it (e.g., vendor registration). Do not delete it.

### 3. Verify branding consistency
- Ensure the support email shown below the form remains `vypaarsupport@ramky.com`.
- Ensure the page title/meta tags in `index.html` already reflect "Vypaar Portal" and are left unchanged.

## Out of scope
- No changes to authentication logic, validation, or API calls.
- No changes to other pages or navigation headers unless explicitly requested.

## Success criteria
- Login page shows a clear left-right split on desktop.
- Left panel displays the Ramky logo and description without the watermark background.
- Right panel still functions as the login form.
- Page remains fully responsive on smaller viewports.
- Build and type check pass after implementation.
