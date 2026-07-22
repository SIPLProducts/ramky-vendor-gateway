Plan: Change the heading and description text on the Select Vendor Type screen to white so they are readable against the transparent card and dark background image.

File to edit:
- `src/pages/VendorRegistration.tsx`

Changes:
1. Update the `<h1>` title "Select Vendor Type"
   - Change `text-slate-900` to `text-white`.

2. Update the `<p>` description "Choose the vendor category to begin your registration. You can change this later."
   - Change `text-slate-600` to `text-white/90` or `text-white` for consistency and readability.

3. No other UI, layout, or functionality changes.
