## Add Ramky background to Vendor Type selection screen only

**Scope:** Only the "Select Vendor Type" screen inside `src/pages/VendorRegistration.tsx` (lines ~1315–1360 block). No other screen, no other file.

### Steps

1. **Add the uploaded background image as a Lovable asset**
   - Register `user-uploads://image-598.png` via the assets CLI → `src/assets/ramky-hero-bg.png.asset.json`.
   - Import the pointer at the top of `VendorRegistration.tsx`.

2. **Restructure the vendor-type screen `<main>`**
   - Replace the centered card layout with a full-height split:
     - Background: the Ramky image covers the whole `<main>` area (`bg-cover bg-center`), with a dark gradient overlay (`from-slate-950/70 via-slate-900/50 to-transparent`) for depth and readability.
     - **Left half (hidden on mobile, ~55% on `lg`):** a soft text block over the image — welcome heading "Welcome to Ramky Vendor Portal" + short tagline "Towards sustainable growth" + the group companies line (Ramky Infrastructure · Estates · Smilax · Foundation). Light typography over the dark overlay.
     - **Right half (~45%):** the existing selection card, kept intact (invited email banner, heading, `VendorTypeSelector`, Continue button). Card gets a subtle `backdrop-blur-sm bg-card/95` treatment so it sits cleanly over the image.
   - On mobile: image becomes a top banner (h-40) with the card stacked below full-width — no horizontal split.

3. **Keep everything else unchanged**
   - Header, `VendorTypeSelector` component internals, submit logic, routing, and every other step/screen stay exactly as-is.

### Technical notes
- Use Tailwind utilities + inline `style={{ backgroundImage: `url(${bg.url})` }}` on the main wrapper.
- Overlay via absolutely positioned gradient div; content in a `relative z-10` grid.
- No new dependencies.

### Validation
- Load `/vendor/registration` in fresh state → Vendor Type screen shows Ramky background with selection card on the right, cards readable, Continue works. Other steps unaffected. `tsgo --noEmit` clean.