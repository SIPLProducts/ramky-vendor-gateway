## Goal
Remove the vendor feedback popup that appears after submission, as well as the standalone `/feedback` page that belongs to the same feature, while leaving the rest of the app untouched.

## Changes

### 1. Remove popup usage from vendor registration flow
- File: `src/pages/VendorRegistration.tsx`
- Remove the `FeedbackPopup` import.
- Remove the `showFeedback` state declaration (`useState(false)`).
- Remove the `setShowFeedback(true)` call inside `handleSubmissionDialogClose`.
- Remove the `<FeedbackPopup ... />` JSX rendered after the success screen.
- Remove any now-unused imports/state if applicable.

### 2. Delete the popup component
- File: `src/components/vendor/FeedbackPopup.tsx`
- Delete this file entirely.

### 3. Delete the standalone public feedback page
- File: `src/pages/VendorFeedback.tsx`
- Delete this file entirely.

### 4. Remove the `/feedback` route
- File: `src/App.tsx`
- Remove the `VendorFeedback` import.
- Remove the `<Route path="/feedback" element={<VendorFeedback />} />` declaration.

## Out of scope
- The Supabase `vendor_feedback` table will be left as-is in the database/types; only the UI that creates feedback records is removed.
- No backend or edge-function changes are required.

## Verification
- Run `bun run build` (or the project's standard build command) to confirm there are no broken imports or TypeScript errors.
- Confirm the registration success screen no longer shows the feedback dialog.