# Select Vendor Type Card Polish

## Goal
Update the visual styling of the main "Select Vendor Type" card on the vendor registration landing screen so it has a light blue border and a semi-transparent background, while keeping the existing background image and functionality intact.

## What will change
- File: `src/pages/VendorRegistration.tsx` — the card that contains the "Select Vendor Type" heading and the `VendorTypeSelector`.
- Adjust the border color to a visible light blue (e.g., `border-blue-200`).
- Adjust the background to be semi-transparent (e.g., `bg-blue-50/70`) so the main-screen background image still shows through.
- Keep the Domestic/International option cards semi-transparent as already configured in `VendorTypeSelector.tsx`.
- No functional or business logic changes.

## Notes
- Layout, responsiveness, hover states, and the option-card images remain untouched.
- The header and "Continue" button remain unchanged.