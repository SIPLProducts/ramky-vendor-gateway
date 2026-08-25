# Remove Orange Border from Select Vendor Type Card

## Goal
Remove the orange (`warning`) border from the vendor type selection card on the registration gating screen.

## Current State
- `src/pages/VendorRegistration.tsx` (around line 1669) wraps the "Select Vendor Type" card with `border-2 border-warning`, giving it an orange outline.
- `src/components/vendor/steps/international/VendorTypeSelector.tsx` uses `border-slate-200` / `border-brand-green` for individual option buttons, which should remain unchanged.

## Change
In `src/pages/VendorRegistration.tsx`, replace the card container's `border-2 border-warning` with a neutral slate border (`border border-slate-200`) so the card matches the rest of the app's white-card styling while keeping the white background, rounded corners, and shadow.

## Verification
- Open the vendor registration gating screen.
- Confirm the "Select Vendor Type" card no longer has an orange border.
- Confirm selected option still shows the green ring/check indicator.
