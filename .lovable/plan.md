## Revert Vendor Type screen to clean centered card

**Scope:** Only the vendor-type selection screen inside `src/pages/VendorRegistration.tsx` (the `!vendorTypeChosen && !isSubmitted` block). No other screen or step changes.

### What changed earlier
- The vendor-type `<main>` was rebuilt as a full-height split layout with the Ramky hero image as background.
- A left-side brand panel and a right-side translucent selection card were added.

### What to revert to
- The screenshot you shared: a plain light grey background, the existing header at the top, and the original centered white selection card containing the invited-email banner, "Select Vendor Type" heading, the two vendor-type option cards, and the Continue button.

### Steps

1. **Restore the centered card layout**
   - Replace the current `<main>` block (split image layout + overlay + left brand messaging + right translucent card) with the original simple centered card:
     ```
     <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
       <div className="w-full max-w-2xl bg-card rounded-[10px] shadow-lg border p-6 sm:p-8 space-y-6">
         {isTokenMode && invitationEmail && ...}
         <div className="space-y-1">...</div>
         <VendorTypeSelector ... />
         <div className="flex justify-end pt-2">...
         </div>
       </div>
     </main>
     ```

2. **Remove the Ramky hero background**
   - Delete the `ramkyHeroBg` import from `src/pages/VendorRegistration.tsx`.
   - Remove the `src/assets/ramky-hero-bg.png.asset.json` asset pointer since it will no longer be referenced.

3. **Keep everything else unchanged**
   - Header stays exactly as-is (logo + "Vendor Registration" / "Vendor Portal").
   - `VendorTypeSelector`, `pendingChoiceType`, `confirmChoice`, Continue button, invitation email banner, and submit disabled state remain untouched.
   - All other registration steps and routing stay as-is.

### Validation
- Open `/vendor/registration` fresh → vendor-type screen shows the plain grey background and centered card matching the screenshot.
- "Continue" still advances to Step 1.
- `tsgo --noEmit` passes.