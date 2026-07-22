## Redesign Domestic & International vendor type cards

**File:** `src/components/vendor/steps/international/VendorTypeSelector.tsx` (only file touched)

### Visual changes
- Card background: soft blue tint (`bg-blue-50/60`, selected: `bg-blue-100/70`).
- Left accent bar: 4px solid brand green (`#00a13a` from `tailwind.config.ts` `brand.green`) applied via a left border or absolute-positioned `::before` bar, full card height, rounded on the left.
- Container: `rounded-xl`, `shadow-sm`, hover `shadow-md` + subtle lift (`hover:-translate-y-0.5 transition`), keyboard focus ring preserved.
- Padding: `p-5`, gap `gap-4` between icon and text; responsive grid stays `md:grid-cols-2`.

### Icon treatment
- Replace inline SVGs with high-quality flag graphics:
  - Domestic: Indian flag rendered via emoji-quality SVG (crisp tricolor + detailed 24-spoke Ashoka Chakra) placed in a rounded white tile (`h-12 w-12 rounded-lg bg-white shadow-sm flex items-center justify-center`).
  - International: stylized globe/world icon (upgraded SVG with meridians + continents silhouette) in the same tile treatment.
- Icon sits on the LEFT of the title, vertically centered with the text block.

### Typography
- Title: `text-[18px] font-semibold text-slate-900`.
- Add short description line back under the title at `text-[14px] font-medium text-slate-600`:
  - Domestic: "Indian vendors — full KYC, GST, PAN, MSME and Bank flow"
  - International: "Overseas vendors — SWIFT/IBAN, country & region based flow"
  (Matches the reference screenshot which shows description text.)

### Selected state
- Keep existing "Selected" pill (top-right) and radio dot, but restyle to brand green (`brand.green`) instead of emerald so it matches the left accent bar.
- Selected card: green left bar remains, slightly stronger blue background, green ring (`ring-1 ring-brand-green/40`).

### Preserved
- All props, `onChange`, `disabled`, `role="radio"`, aria state, keyboard focus.
- Grid layout, parent integration in `VendorRegistration.tsx` — no other files edited.

### Validation
- Run typecheck/build after edit.
