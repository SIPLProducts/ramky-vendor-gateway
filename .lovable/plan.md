# Make vendor type card subtly transparent

## Goal
On the vendor type selection screen, make the right-side "Select Vendor Type" card semi-transparent so the Ramky background image shows through subtly, while keeping the contents readable.

## What will change
- In `src/pages/VendorRegistration.tsx`, the right-side selection card currently uses `bg-card/95 backdrop-blur-md`.
- Change it to `bg-card/75 backdrop-blur-md` (or equivalent token opacity) so the card is subtly see-through.
- Keep the border, shadow, padding, and internal layout identical.
- Keep the left brand messaging and dark gradient overlay untouched.

## Why this approach
- The user confirmed the target is the vendor type card and prefers subtle transparency (roughly 70-80% opaque).
- A 75% opacity card keeps text readable while letting the background image softly appear behind it.
- `backdrop-blur-md` ensures the image behind the card is softly diffused so foreground text remains legible.

## Validation
- Load `/vendor/registration` and verify the card background is subtly see-through.
- Confirm the card text and radio options remain easy to read.
- Run a quick typecheck to ensure no TS errors.