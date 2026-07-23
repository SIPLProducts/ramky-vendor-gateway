Plan:
1. Update the Vendor Type selector card image layout so the image is never cropped.
2. Replace the current `object-cover` behavior with a true fit-to-card behavior and align the image container to the actual asset ratio, so the full Indian flag and world map remain visible.
3. Make the selector responsive for short screens by allowing the two cards to scale down cleanly inside the available height instead of clipping.
4. Keep the existing vendor type selection logic, Continue button, selected state, and disabled state unchanged.
5. Remove any remaining animation-related styling from this selector if still present, since you asked for no animation.