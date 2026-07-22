Plan: Update the Select Vendor Type landing card and the Domestic/International option cards to use a transparent/semi-transparent modern look while keeping full responsiveness.

Files to edit:
- `src/pages/VendorRegistration.tsx`
- `src/components/vendor/steps/international/VendorTypeSelector.tsx`

Changes:
1. Main "Select Vendor Type" card
   - Replace `bg-blue-50/70` and `border-blue-200` with a transparent background (`bg-white/10` or `bg-transparent`) and a light white border (`border-white/40` or `border-white/30`).
   - Keep the `backdrop-blur-sm` and `shadow-2xl` for depth.
   - Ensure the card width stays `w-full max-w-md` and is centered on the page.

2. Domestic and International option cards
   - Keep them semi-transparent (`bg-white/50` default, `bg-white/70` hover, `bg-white/80` selected) with `backdrop-blur-sm`.
   - Keep the light white border (`border-white/60`) and the existing green ring/selected state.
   - Keep the 3D illustration centered.

3. Responsiveness
   - Maintain the existing flex/column layout so the cards stack vertically on all screen sizes.
   - Keep the card padding responsive (`p-5 sm:p-6`).
   - Maintain the current illustration height for consistent scaling.

4. No functionality changes
   - The selection value, `onChange`, `confirmChoice`, disabled state, and navigation logic will remain unchanged.
