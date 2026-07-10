Plan

1. Remove the stat counts from the login hero
   - File: `src/pages/Auth.tsx`
   - Remove the 3-column grid currently showing:
     - 500+ Active Vendors
     - ₹2000Cr+ Annual Procurement
     - 15+ States Covered
   - Keep the hero image, gradient overlay, logo, heading and subheading intact.

2. Add support contact message at the bottom
   - File: `src/pages/Auth.tsx`
   - Below the existing copyright line, add a centered line:
     "For any queries or support, please contact: vendxsupport@ramky.com"
   - Make `vendxsupport@ramky.com` a `mailto:` link using the existing `text-primary` / `hover:underline` pattern.
   - Style with existing semantic classes (`text-sm text-muted-foreground text-center`) so it fits the current footer area.

3. Verify
   - Run `bunx tsgo --noEmit` (or the project's TypeScript check) to ensure no type errors.
   - Confirm the preview no longer shows the three counts and the support line appears at the bottom of the login page.