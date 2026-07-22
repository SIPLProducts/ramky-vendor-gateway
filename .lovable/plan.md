## Goal
Update the Select Vendor Type screen so the card area shows a **light blue background** (instead of the current image/dark overlay), and the **Domestic** and **International** option cards become **semi-transparent** so the light blue shows through.

## Changes

### 1. `src/pages/VendorRegistration.tsx` (vendor-type selection screen)
- Remove the full-screen `Background_MainScreen_Image.png` background from the outer container.
- Restore the outer page background to a neutral app background.
- Change the Select Vendor Type card wrapper to use a **light blue background** (e.g. `bg-blue-50` / `#eaf2fb`) with soft rounded corners and subtle shadow.
- Restore text colors to dark (heading + description) so they read on light blue.
- Keep card centered, `max-w-md`, responsive.

### 2. `src/components/vendor/steps/international/VendorTypeSelector.tsx`
- Make the two option cards (Domestic, International) **semi-transparent** (e.g. `bg-white/50` or `bg-white/40` with `backdrop-blur-sm`) so the light blue parent shows through.
- Keep the green left accent, icons, titles, and hover elevation intact.

## Out of scope
- No changes to logic, validation, or flow.
- Background image asset stays in the project; only its usage on this screen is removed.
