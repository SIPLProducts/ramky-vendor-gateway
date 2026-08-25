# Select Vendor Type card — match screenshot

## Goal
Make the "Select Vendor Type" card look like the attached screenshot: a clean white card with centered content, larger readable option labels, and a clearly legible, centered Continue button.

## Changes

### Card (`src/pages/VendorRegistration.tsx`)
- Keep the card on the right side of the screen, slightly wider (`w-[min(92vw,340px)]`).
- Solid white surface with soft shadow and rounded corners, replacing the translucent look; keep the existing orange border on the card outline as-is.
- Increase inner padding to `p-4`/`p-5` and add consistent vertical spacing between title, options, and the action button.
- Title "Select Vendor Type" left-aligned as in the screenshot, `text-base font-semibold text-slate-900`.

### Options (`src/components/vendor/steps/international/VendorTypeSelector.tsx`)
- Options become full-width rows inside the card (remove the `max-w-[220px]` cap).
- Label text centered, larger and clearer: `text-sm font-semibold`.
- Unselected: white background with light grey border. Selected: green border/ring with the green check circle pinned on the right (as shown).
- Slightly taller rows (`py-3.5`) with rounded-xl corners.

### Continue button
- Centered under the options.
- Bigger and more legible: `h-11`, `text-sm font-semibold`, wider min-width, chevron kept on the right.

## Out of scope
- No changes to vendor type logic, validation, or routing.
- No changes to the background watermark or header.
