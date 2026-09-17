# Match the Vendor Registration Main Screen Reference

## Goal
Recreate the first reference screen for the initial vendor-type selection, using the uploaded `WhatsApp Image 2026-09-17 at 11.30.29 AM (1).jpeg` as the actual left-side image.

## Changes
1. **Create the split-screen opening view**
   - Remove the current registration header and watermark treatment from the vendor-type selection screen only.
   - Use a full-height two-panel layout matching the reference: the uploaded Ramky collage fills the large left panel, while a pale blue area fills the right panel.
   - Keep the collage fully covering its panel without stretching, with its central Ramky logo clearly visible.

2. **Match the vendor-type panel**
   - Place a compact dark-blue selection panel in the right area, vertically centered.
   - Match the reference hierarchy: small decorative indicator, white “Select Vendor Type” title, Domestic and International rows, and centered Continue button.
   - Add the building and globe icons, selected cyan outline/check state, and unselected radio state shown in the reference.
   - Preserve the existing selection and Continue behavior without changing registration logic.

3. **Use the supplied image as an app asset**
   - Store the uploaded original through the project asset service and reference it from the registration screen.
   - Do not use the first screenshot itself as page artwork; it remains the visual layout reference.

4. **Responsive behavior**
   - On desktop, retain the wide image-left/card-right composition.
   - On smaller screens, keep the selection panel readable and usable while showing the supplied image as the supporting visual without overflow or cropped controls.

5. **Verification**
   - Check desktop and mobile layouts against the supplied reference.
   - Verify both vendor choices, selected states, and Continue navigation still work.
   - Confirm the latest build has no errors.

## Technical scope
- Presentation changes only in the initial vendor-type gate inside `VendorRegistration.tsx` and `VendorTypeSelector.tsx`.
- Add semantic styling tokens/utilities in `src/index.css` or the existing theme configuration as needed.
- Add one asset pointer for the uploaded collage.
- No changes to vendor data, validation, approvals, or later registration steps.
