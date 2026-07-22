## Goal

Apply the uploaded `Background_MainScreen_Image.png` as the background of the **entire Vendor Registration main screen** (not just the Select Vendor Type card). The Select Vendor Type card itself should be **transparent** so the background image shows through.

## Changes

### 1. `src/pages/VendorRegistration.tsx`
- Remove the background image styling currently applied to the Select Vendor Type card wrapper (`max-w-md` centered card with `Background_MainScreen_Image.png`).
- Apply the background image to the **outermost page container** of the vendor registration screen so it covers the whole viewport area:
  - `background-image: url(Background_MainScreen_Image.png)`
  - `background-size: cover`
  - `background-position: center`
  - `background-repeat: no-repeat`
  - Add a subtle dark/blue gradient overlay only where needed for text legibility (kept minimal so image remains visible).
- Restore the Select Vendor Type card to its natural width and centering (no forced `max-w-md`), but with a **transparent background** (`bg-transparent`, no shadow, no border) so the main-screen background image shows through.

### 2. `src/components/vendor/steps/international/VendorTypeSelector.tsx`
- Ensure the inner container has no opaque background (`bg-transparent`).
- Keep the two Domestic / International option cards as-is (they remain visible on top of the transparent parent + main background).

## Out of scope
- No changes to business logic, validations, or step flow.
- No changes to the Domestic/International option card contents.
- Background image asset already uploaded to CDN — reused as-is.
