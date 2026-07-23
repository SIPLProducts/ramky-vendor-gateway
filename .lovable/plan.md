## Goal
Make the Domestic and International vendor type cards more visually striking by using full-bleed imagery, removing the visible image frame, and upgrading the Indian flag to a beautiful waving version.

## Changes

### 1. Regenerate hero images
- `src/assets/vendor-domestic-flag.png` — replace with a **waving Indian flag** (silk/fabric texture, natural folds, soft cinematic lighting, tricolor with Ashoka Chakra crisp and centered). Wider aspect ratio (e.g. 1600×900) so it fills the card edge-to-edge without cropping the chakra.
- `src/assets/vendor-international-map.png` — regenerate as a wider, edge-to-edge world map (globe/continents visual) matched to the same aspect ratio for visual parity.

### 2. Update `src/components/vendor/steps/international/VendorTypeSelector.tsx`
- Remove the inner bordered image container (drop `border`, `rounded`, inner padding around the `<img>`).
- Make the image **full-width and full-bleed** inside the card: image spans 100% width, no side padding, sits flush to the card edges at the top.
- Keep the card's own outer rounded corners; clip the image with matching top rounding (`rounded-t-*`) so no white gap shows around it.
- Preserve current text, selection state, hover, and click behavior — no logic changes.

### 3. Do not touch
- Vendor Registration page logic, subtitle removal, on-behalf flow, or any other component.
- Classification card behavior.

## Verification
- Build succeeds and both new PNGs are bundled.
- Cards render with edge-to-edge imagery, no visible inner border, and the Indian flag appears as a natural waving flag.
