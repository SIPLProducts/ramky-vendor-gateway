Goal: optimize only the Vendor Type selection UI so the full Select Vendor Type section fits inside the viewport at 100% zoom, with no page scrollbar and no image cropping.

Plan:
1. Update the Vendor Type gating screen wrapper in `VendorRegistration.tsx`:
   - Use a fixed viewport-height page container instead of `min-h-screen` for this screen.
   - Keep the header at 64px and make the main area exactly the remaining height.
   - Reduce outer padding and inner panel padding/gaps so content fits in shorter laptop viewports.
   - Remove the inner `overflow-y-auto` fallback that creates the visible scrollbar on this screen.

2. Update `VendorTypeSelector.tsx` sizing:
   - Slightly reduce each card’s max width.
   - Replace the current large `clamp(180px, 32vh, 400px)` image height with a responsive height based on available viewport, so two vertical cards plus title/button fit naturally.
   - Keep `object-contain` so the Indian flag and world map remain fully visible without cropping or overflow.
   - Reduce card title padding and grid gaps.

3. Preserve existing functionality:
   - Do not change vendor type selection state, Continue behavior, disabled states, routing, or backend logic.
   - Only adjust layout classes/styles for this selection screen.

4. Verify after implementation:
   - Check the current viewport size similar to the user’s preview.
   - Confirm no vertical scrollbar appears on the Vendor Type selection screen.
   - Confirm both images are fully visible and cards remain vertically stacked and responsive.