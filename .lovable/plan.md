## Vendor Type Selection Card — Background Image + Narrower Centered Layout

### Assets
1. Upload the reference `Background_MainScreen_Image.png` as a Lovable asset:
   - `lovable-assets create --file /mnt/user-uploads/Background_MainScreen_Image.png --filename vendor-type-bg.png > src/assets/vendor-type-bg.png.asset.json`
   - Import via `import bgAsset from '@/assets/vendor-type-bg.png.asset.json'` for the CDN URL.

### Files to modify

**1. `src/pages/VendorRegistration.tsx` (around lines 1600–1624)**
- Reduce the outer card width: change `max-w-2xl` → `max-w-md` (≈ 448px) so the card is noticeably narrower and centered on the page (already inside `flex items-center justify-center`).
- Apply the uploaded image as the card background:
  - `style={{ backgroundImage: \`url(${bgAsset.url})\`, backgroundSize: 'cover', backgroundPosition: 'center' }}`
  - Add a subtle dark overlay (e.g. `bg-slate-900/40` layer or `bg-gradient-to-b from-slate-900/60 to-slate-900/80`) so foreground text and cards remain legible over the busy blue tech image.
- Update heading + description colors to white / white-70 to sit on the dark image.
- Keep vertical padding responsive: `p-5 sm:p-6` and `space-y-5`.
- Preserve `Invited Email` banner, `VendorTypeSelector`, and Continue button unchanged in behavior.

**2. `src/components/vendor/steps/international/VendorTypeSelector.tsx`**
- Remove the inner blue panel background (`bg-[#eaf2fb] border-[#d6e4f5]`) since the parent card now owns the background image. Change wrapper to transparent (`p-0` or a light translucent white `bg-white/5`) so the two white option cards float over the image.
- Keep white option cards, 3D illustrations, titles, selected pill, radiogroup semantics — no functional changes.

### Responsiveness
- Mobile (`<640px`): card spans nearly full width via `w-full max-w-md` + `p-4` container padding already present on `<main>`.
- Tablet/Laptop/Desktop: fixed `max-w-md` keeps card compact and centered.
- Background image uses `bg-cover bg-center` so it scales cleanly at every breakpoint.

### Out of scope
- No changes to selection logic, routing, validation, or any downstream steps.
- No changes to the main multi-step registration layout (only the pre-step "Select Vendor Type" screen).

### Verification
- Typecheck + build.
- Playwright screenshot of `/vendor/registration` at 375px, 768px, 1280px widths confirming: narrower centered card, uploaded background image visible, two white option cards legible, Continue button works.
