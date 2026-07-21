## Goal
Adjust the GST section headers (Identity, Registration, Place of Business, Jurisdiction) so the orange underline sits only underneath the text itself, not stretched across the entire section width.

## Changes

### 1. Update `SectionHeading` underline width
File: `src/components/vendor/steps/DocumentVerificationStep.tsx`
- Change `SectionHeading` from applying the orange underline directly on the block-level `<h4>` to applying it on an inner inline wrapper around the text.
- Use `inline-block` or `w-fit` so the underline length matches the label text length.
- Keep the smaller font size and uppercase styling already in place.

Example structure:
```tsx
<h4 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
  <span className="border-b border-warning/70 pb-1">{children}</span>
</h4>
```

## Result
The orange underline will appear only beneath the header text (e.g. "Identity", "Registration") and will not extend to the full section width.