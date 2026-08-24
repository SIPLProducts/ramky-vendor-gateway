Add an orange border to the "Select Vendor Type" outer card

Goal
Make the outer card that wraps the "Select Vendor Type" title and options on the vendor registration landing screen visibly orange, using the existing warning color token.

Where to change
- `src/pages/VendorRegistration.tsx` around the container that renders the type selector (`lines ~1653-1695`).

Current state
- The card currently has a subtle white border: `border border-white/50`.
- The selected option inside uses a green border (`border-brand-green`); that will remain unchanged.

Planned change
1. Replace the outer card border on the type-selection card with the warning token color:
   - Change `border border-white/50` to `border-2 border-warning` (or `border border-warning` if a 1px border is preferred for visual consistency).
2. Keep the existing `rounded-[12px]`, `bg-white/25`, `backdrop-blur-[2px]`, and `shadow-lg` unchanged.
3. Verify that the card still renders centered, the title and options remain unaffected, and the border color matches the design-system warning token.

Out of scope
- No changes to the selected vendor-type option border.
- No changes to other registration cards or steps.
- No backend or behavior changes.
