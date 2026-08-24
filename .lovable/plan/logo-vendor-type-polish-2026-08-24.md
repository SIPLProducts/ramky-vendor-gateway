# Logo & Vendor Type Polish

## 1. Login page logo tiles
- Remove the white card behind both logos (top-right and left panel) so the logo sits directly on the light grey page surface — no more white-on-grey mismatch.
- Increase logo size: left panel logo from h-24/h-32 to roughly h-40/h-48; top-right logo from h-10 to about h-16.

## 2. Vendor Registration — Select Vendor Type card
- Make the card transparent: replace the solid white card with a light translucent surface plus blur so the Ramky watermark background shows through.
- Make the two option buttons translucent as well, keeping text readable.
- Fix the overlapping "Selected" badge: move it out of the card corner into the option row (inline, right side of the label) so it no longer sits on top of the card edge/title.

## 3. Registration navbar
- Move "Vypaar Portal" text to the far left of the header and keep the logo on the far right (currently both are grouped on the right). Applies to all four header variants inside the registration page (token mode and link mode, gating screen and submitted screen).

## Technical notes
- Files: `src/pages/Auth.tsx`, `src/pages/VendorRegistration.tsx`, `src/components/vendor/steps/international/VendorTypeSelector.tsx`.
- Presentation only — no logic, routing, or data changes.
