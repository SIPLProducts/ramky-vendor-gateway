Plan: Update the vendor type selector in the registration main screen

1. **File to change:** `src/components/vendor/steps/international/VendorTypeSelector.tsx` (the only place that contains the Domestic/International option cards and descriptions).

2. **Changes:**
   - Remove the `desc` field from the option definitions and delete the `<p>` element that renders the description under each card title.
   - Replace the `MapPin` icon for **Domestic Vendor** with an inline SVG of the Indian flag (saffron, white, green stripes + Ashoka Chakra).
   - Replace the `Globe2` icon for **International Vendor** with an inline SVG of a stylized world map (continents inside a rounded frame) that uses `currentColor` so it adapts to the selected/muted state.
   - Preserve the existing card layout, selected "Selected" badge, hover/focus states, and disabled behavior.

3. **Validation:** Run a build/typecheck after the edit to confirm no regressions.

No other components need to be touched because the descriptions are only defined inside this component.