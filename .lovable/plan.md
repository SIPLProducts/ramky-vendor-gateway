## Vendor Type Selection UI Updates

### Files to modify
1. `src/components/vendor/steps/international/VendorTypeSelector.tsx`

### Changes

1. **Restore the 3D illustration images** on both cards
   - Re-import `vendor-domestic-3d.png` and `vendor-international-3d.png` from `src/assets/`.
   - Render the illustration centered inside each card (above or beside the title).

2. **Remove descriptions** under each card
   - Delete the `desc` paragraph rendering.
   - Drop the `desc` field from the `OPTIONS` array (keep only `value` + `title` + `image`).

3. **Apply the bluish background** from the reference screenshot
   - Update the panel wrapper to a slightly deeper/more saturated blue tint that matches the reference (e.g. `bg-[#eaf2fb]` with `border-[#d6e4f5]`), replacing the current `bg-blue-50/60`.
   - Keep rounded-2xl padding and subtle shadow.

4. **Single heading only**
   - The heading "Select Vendor Type" already lives in `src/pages/VendorRegistration.tsx` above the selector — no duplicate heading inside the selector component.

5. **Preserve functionality**
   - Keep `role="radiogroup"`, `role="radio"`, `aria-checked`, keyboard focus, disabled state, `onChange(value)`, the green "Selected" pill, and the selection ring.

### Verification
- Typecheck + build.
- Playwright screenshot of `/vendor/registration` confirming: bluish panel background, two white cards each showing their 3D illustration and title only (no descriptions), single heading at the top, selection state still works.
