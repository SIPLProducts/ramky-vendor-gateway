Vendor Type Selection UI Changes

### Files to modify
1. `src/components/vendor/steps/international/VendorTypeSelector.tsx`
2. `src/pages/VendorRegistration.tsx`

### Changes

1. Remove the duplicate heading and description
   - The page currently renders `Select Vendor Type` / `Choose the vendor category...` once inside `VendorTypeSelector` and once immediately above it in `VendorRegistration.tsx`.
   - Keep the single heading and description in the parent page (`VendorRegistration.tsx`), and remove the duplicate heading/description block from inside `VendorTypeSelector`.

2. Apply the blue background to the Vendor Type cards container
   - Replace the current dark navy gradient panel (`bg-gradient-to-b from-[#0b1a3a] via-[#0f2350] to-[#0b1a3a]`) with a soft blue panel that matches the app theme.
   - Suggested style: `bg-blue-50/60 border border-blue-100/80 rounded-2xl p-6` (or a Tailwind equivalent using a project blue token if available).
   - The blue background must visibly wrap the Domestic and International cards.

3. Remove the 3D illustration images
   - Remove the `<img>` element rendered below the card title/description.
   - Remove the now-unused `domesticIllustration` and `internationalIllustration` imports and the `image` / `alt` fields from the `OPTIONS` array.
   - Keep the card title, description, and Selected pill; only the illustration is removed.

4. Preserve existing functionality
   - Maintain `role="radiogroup"`, `role="radio"`, `aria-checked`, keyboard focus, disabled state, and `onChange(value)` behavior.
   - Keep the green Selected pill and the ring selection indicator.

### Verification
- Typecheck and production build.
- Playwright screenshot of `/vendor/registration` to confirm:
  - One heading and description at the top.
  - Blue background panel surrounding the two cards.
  - No images below the card title/description.
  - Selection and hover states still work.