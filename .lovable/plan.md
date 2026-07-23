## Vendor Type Card Image Fit

Update `src/components/vendor/steps/international/VendorTypeSelector.tsx`:

- Remove all animations (Ken Burns / entry animations / hover scale) from the image blocks.
- Make the flag and world map images fill their card area edge-to-edge with no gaps and no cropping distortion.
  - Keep the fixed `aspect-[16/9]` container.
  - Use `object-cover w-full h-full` with `object-center` so the image fills the full width and height of the card image area.
  - Remove gradient background fills (no longer needed since the image fully covers).
- Keep the existing card structure, "Selected" badge, titles ("Domestic Vendor" / "International Vendor"), and selection logic untouched.

Optionally clean up unused `ken-burns` keyframes in `tailwind.config.ts` since no other component uses them.

No changes to any other file or business logic.