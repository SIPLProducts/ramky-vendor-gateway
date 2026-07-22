## Redesign Vendor Type selection to match reference screenshot

**File touched:** `src/components/vendor/steps/international/VendorTypeSelector.tsx` (only)
**New assets:** two 3D illustration images generated via imagegen into `src/assets/`

### Container / background
- Wrap the radio group in a dark navy gradient panel (`bg-gradient-to-b from-[#0b1a3a] via-[#0f2350] to-[#0b1a3a]`), rounded-2xl, padded `p-6`, subtle inner glow.
- Small heading above the cards inside the panel:
  - Title: "Select Vendor Type" — `text-white text-lg font-semibold`
  - Subtitle: "Choose the vendor category to begin your registration. You can change this later." — `text-white/60 text-xs`

### Cards (stacked vertically, not grid)
- Change layout from `md:grid-cols-2` to a single-column vertical stack with `gap-4`.
- Each card:
  - White background (`bg-white`), `rounded-xl`, `shadow-lg`, `p-5`, relative.
  - Title centered at top: `text-[18px] font-semibold text-slate-900`.
  - Large 3D illustration centered in the middle (`h-40` container, `object-contain`).
  - Description centered below illustration: `text-[13px] font-medium text-slate-600`.
  - Green "SELECTED" pill in top-right when selected (brand-green background, white text, rounded-full, tiny check icon) — same style as reference.
  - Subtle hover lift (`hover:-translate-y-0.5 hover:shadow-xl transition`).
  - Selected state: `ring-2 ring-brand-green` around the card.
- Remove the left green accent bar and the small white icon tile from the current design — reference does not use them.

### Illustrations (generated with imagegen, premium quality, transparent PNG)
- `src/assets/vendor-domestic-3d.png` — 3D illustration: stack of Indian KYC documents (PAN card, GST certificate with ₹ / GST tags, Aadhaar-style ID) fanned out, with a small Indian flag ribbon on top. Clean isometric 3D, soft shadows, white background, matches reference style.
- `src/assets/vendor-international-3d.png` — 3D illustration: globe with a small airplane orbiting, a suitcase and passport in front, compass beside. Isometric 3D, soft shadows, white background, matches reference style.
- Import both as ES6 image imports and render via `<img>` inside each card.

### Radio semantics preserved
- `role="radiogroup"`, `role="radio"`, `aria-checked`, keyboard focus ring, `disabled` handling, `onChange(value)` contract — all unchanged.
- Props/interface unchanged; only visuals change. No other files edited.

### Validation
- Typecheck + build.
- Playwright screenshot of `/vendor/registration` to visually confirm the panel matches the reference (dark navy panel, two stacked white cards with 3D art, selected pill on the active card).
