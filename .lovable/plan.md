## Fixes

### 1. Center "Vendor Portal" text in sidebar (`src/components/layout/Sidebar.tsx`)
The sidebar header row currently left-aligns the "Vendor Portal" label next to the logo. Center the label in the header area (both expanded and collapsed states remain visually balanced).

### 2. Mobile compatibility

**a. Show all screen names in a mobile menu (`src/components/layout/MobileHeader.tsx`)**
Today the mobile view only exposes a bottom nav limited to 5 items — most screen names from the sidebar are hidden. Add a hamburger (Menu icon) button on the left of `MobileHeader` that opens a `Sheet` containing the full list of screens the user has permission to see (reuse `useScreenPermissions` + the same nav item catalog used by the sidebar). Each item links to its route and closes the sheet on click.

**b. Vendor registration form on mobile (`src/pages/VendorRegistration.tsx` + step components)**
The registration screen (route in the screenshot) is not mobile-friendly:
- Wrap the sticky horizontal stepper so labels don't overflow: switch to horizontal scroll on `sm:` and below, shrink circle + text sizes.
- Make the top "on behalf of…" banner stack vertically on small screens and reduce padding.
- Ensure the outer container uses `px-3 sm:px-6` and the form card uses `p-4 sm:p-6`.
- Sticky action bar (`StickyActionBar.tsx`): stack the Cancel / Save Draft / Back / Continue buttons in a 2-column grid on mobile so they don't overflow, and hide the center validation pill on mobile (already hidden — keep, but surface the tooltip as inline text above the buttons on mobile).
- Doc verification tabs (`KycTabs.tsx`): allow horizontal scroll on small screens.

No behavioral/business-logic changes — visual/layout only.

### 3. Wrong tick marks on Contact Details & Financial & Infrastructure (`src/pages/VendorRegistration.tsx`)

Root cause: the resume logic at lines ~887-890 calls `isDomesticStepComplete` for steps 1-5 and marks any that return true as completed. `isDomesticStepComplete` currently:
- Step 5 (`Financial & Infrastructure`) unconditionally returns `true` (line 138). So it is always pre-checked even in a fresh draft.
- Step 4 (`Contact Details`) only requires `ceoName`, which on-behalf drafts may have empty — but if a prior save seeded anything into `contact.ceoName` it flips on too.

Fix:
- Change step 5 completeness to require the user to have entered at least one meaningful value (e.g. `turnoverYear1` OR any infrastructure text field). If nothing user-entered exists, return `false`.
- Tighten step 4 to require `ceoName` **and** either a valid `ceoEmail` or 10-digit `ceoPhone` (matches the intent that "Contact Details" has been reviewed by the user).
- Additionally, in the resume block, only mark a step complete if the step **before** it is also complete (prevents "step 5 ticked while step 2 is not"). This mirrors the forward-navigation guard already used in `handleStepClick`.

No changes to per-step zod schemas or submit gating — those already tolerate empty optional fields; this only fixes the visual tick state on load.

### Files touched
- `src/components/layout/Sidebar.tsx`
- `src/components/layout/MobileHeader.tsx`
- `src/pages/VendorRegistration.tsx`
- `src/components/vendor/StickyActionBar.tsx`
- `src/components/vendor/kyc/KycTabs.tsx`
