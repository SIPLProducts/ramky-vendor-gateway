## Goal

Keep the main-screen background image, but give the **Select Vendor Type** card a **light blue** background and make the **Domestic** / **International** option cards **semi-transparent**.

## Changes

### 1. `src/pages/VendorRegistration.tsx`
- Keep the fixed `Background_MainScreen_Image.png` on the outer page container (unchanged).
- Update the Select Vendor Type card wrapper (currently `bg-transparent`) to use a light blue background (e.g. `bg-blue-50/90` with subtle border + soft shadow) so it stands out on the image.
- Switch the heading/description text back to dark tones (readable on light blue).

### 2. `src/components/vendor/steps/international/VendorTypeSelector.tsx`
- Make the Domestic and International option cards semi-transparent (e.g. `bg-white/40` with `backdrop-blur-sm`, keeping the green left accent bar, icon tile, and typography).
- Preserve hover elevation and selected state styling.

## Out of scope
- No changes to business logic, form flow, or the background image asset.
