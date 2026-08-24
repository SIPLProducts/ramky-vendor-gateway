# Fix Watermark Logo Cropping on Login Page

The faint Ramky watermark in the login page's left panel is currently pushed off the left edge of the screen, so part of the logo is cut off.

## Change

In the login page background watermark:

- Remove the negative left offset that pushes the image outside the viewport; anchor it inside the left panel with a small positive inset and a bottom gap.
- Slightly reduce its width so the whole mark fits within the left half at common screen widths.
- Keep the same faint opacity and non-interactive behaviour so it stays a subtle background element.

Everything else (gradient background, top-right logo, headline, description, right-side form) stays exactly as-is.

## Technical detail

`src/pages/Auth.tsx` — watermark `<img>` classes change from `absolute -left-24 bottom-0 w-[46rem] max-w-[70vw]` to an inset-safe variant such as `absolute left-6 bottom-8 w-[34rem] max-w-[45vw]`, keeping `pointer-events-none select-none opacity-[0.07]`.
