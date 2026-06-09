## Problem

When a Buyer / Admin uses **Create Vendor (on behalf)** from the Invitations screen, they're navigated into the registration form. After submitting, they land on the `SuccessScreen` ("Application Submitted Successfully" — the screenshot shared). There is no button to return to the Invitations / Applications list, so the only way back is the browser back button or clicking the header logo.

## Fix

Add a **"Back to Applications"** action button on the `SuccessScreen`, visible only when the submitter is an internal user (i.e. NOT the vendor coming in via an invite token). It will navigate to `/admin/invitations`.

### Files

1. **`src/components/vendor/SuccessScreen.tsx`**
   - Add an optional `onBack?: () => void` and `backLabel?: string` prop.
   - When `onBack` is provided, render a secondary button (next to / above the "What Happens Next?" card) labeled "Back to Applications" that calls `onBack()`.
   - No other visual changes.

2. **`src/pages/VendorRegistration.tsx`** (around line 1256 where `<SuccessScreen … />` is rendered)
   - Pass `onBack={() => navigate('/admin/invitations')}` **only when** `!isTokenMode` (so external vendors using the invite link don't see it — they have no portal access).
   - Reuse the existing `navigate` from `react-router-dom`.

## Out of scope

- No changes to the submission flow itself, approval routing, or any backend logic.
- No change to the vendor-token success view (the public success page stays as-is).
- No change to the Invitations table or filters.
