Plan: Update the Vendor Type selection screen

Background
- The user wants the Vendor Type selection card to be cleaner and visually focused: the Domestic card should show only the Indian flag, and the International card should show only a global map. The existing 3D illustrations should be replaced.
- The subtitle "Choose the vendor category to begin your registration. You can change this later." should be removed.
- Existing selection behavior, selected badge, Continue button, and responsiveness must remain unchanged.

Changes

1. Generate new images
   - Generate `src/assets/vendor-domestic-flag.png`: Indian flag image, clean, suitable to display as the main visual inside a card.
   - Generate `src/assets/vendor-international-map.png`: World map / globe image, clean, suitable as the main visual inside a card.

2. Update `src/components/vendor/steps/international/VendorTypeSelector.tsx`
   - Replace imports:
     - `vendor-domestic-3d.png` → `vendor-domestic-flag.png`
     - `vendor-international-3d.png` → `vendor-international-map.png`
   - Keep the card structure, title, selected badge, hover/selection states, and disabled behavior exactly as-is.
   - No new props or logic changes.

3. Update `src/pages/VendorRegistration.tsx`
   - Remove the `<p>` subtitle line that reads: "Choose the vendor category to begin your registration. You can change this later."
   - Keep the `<h1>` heading "Select Vendor Type" and the `VendorTypeSelector` / Continue button.

4. Verify
   - Build the app to confirm no broken imports or TypeScript errors.
   - No runtime state changes beyond the visual replacement.

Scope / Out of scope
   - In scope: visual replacement and subtitle removal only.
   - Out of scope: changing card layout, card size, interaction logic, or navigation behavior.