Polish the Select Vendor Type card appearance

Goal
Improve the visual appearance of the "Select Vendor Type" card on the vendor registration landing screen so it looks more professional, readable, and balanced while keeping the orange border the user previously requested.

Where to change
- `src/pages/VendorRegistration.tsx` — the card container and title area around the vendor-type selector (lines ~1668-1695).
- `src/components/vendor/steps/international/VendorTypeSelector.tsx` — the two option buttons.

Current state
- The card is narrow, translucent, with a 2px orange border and green selected-state ring.
- The option buttons are small, centered, and text-only, which feels cramped on larger screens.
- The Continue button sits tightly under the options with minimal vertical rhythm.

Planned change
1. **Card container**
   - Keep the orange `border-2 border-warning` and translucent background.
   - Increase padding (`p-5` or `p-6`) and max-width (`max-w-sm` / `w-80`) so the card has more breathing room.
   - Add a subtle header/title area with a small top accent or centered title to match the SAP Fiori card style.

2. **Option buttons**
   - Make each option a full-width row inside the card instead of a narrow centered button.
   - Add a left icon (domestic = building/home, international = globe) and a right check-circle indicator.
   - Use a soft background fill (`bg-white/60`) for unselected, and a green-tinted fill (`bg-white/80 ring-2 ring-brand-green`) for selected.
   - Keep the text bold and readable, with a short subtitle under each option.

3. **Continue button**
   - Increase height to `h-10` or `h-11`, use full-width inside the card, and keep the right chevron icon.
   - Add a small top margin so the action is separated from the options.

4. **Spacing & typography**
   - Title: `text-lg font-semibold text-slate-900`, centered or left-aligned with a short helper line.
   - Helper text: `text-xs text-muted-foreground` below the title.

Out of scope
- No changes to the vendor type logic, validation, or routing.
- No changes to the selected-state border logic (still green); only the styling and layout of the buttons are polished.
- No global rebrand or copy changes beyond this card.

Verification
- Open `/vendor/registration` in the preview and confirm the card is wider, the options are full-width rows with icons, and the orange border remains.
- Check that the selected state still highlights clearly and the Continue button is well-spaced.