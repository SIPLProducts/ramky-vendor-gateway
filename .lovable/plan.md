## Problem

When a buyer creates a vendor **on-behalf**, submits it, and it gets rejected at Finance 1 / Finance 2, the vendor row's status becomes `returned_to_buyer`. Clicking **Edit & Resubmit** from Buyer Approval → Rejected navigates to `/vendor/registration?onBehalfOf=<invitationId>`, and the vendor row is loaded correctly from the database — but the registration form renders **empty** (GST, PAN, MSME, bank, addresses, contacts, etc. are all blank).

## Root Cause

In `src/pages/VendorRegistration.tsx` (the `useEffect` at ~line 624), form data is only hydrated from `existingFormData` when `vendorStatus` is in one of these lists:

- `editableStatuses = ['draft', 'validation_failed', 'finance_rejected', 'purchase_rejected', 'returned_to_vendor']`
- `pendingStatuses  = ['submitted', 'validation_pending', 'finance_review', 'purchase_review', 'finance_approved', 'purchase_approved', 'sap_synced']`

`returned_to_buyer` is in **neither** list, so `setFormData(existingFormData)` is never called and the form stays on `initialFormData` (empty). The vendor row is fetched fine (the top banner already reads `last_rejection_comments` / `last_rejection_stage` from it — proof the data is loaded, just not applied to the form).

## Fix (frontend only, one file)

Edit `src/pages/VendorRegistration.tsx`:

1. Add `'returned_to_buyer'` to `editableStatuses` inside the hydration effect.
2. Treat `returned_to_buyer` like `returned_to_vendor`:
   - Mark all steps completed.
   - Set `isEditMode = true`.
   - Jump to the Review step (step 6 for domestic, step 5 for international).
   - Pre-seed `verifiedData` so GST / PAN / MSME / Bank tiles show as verified when the buyer navigates back into Step 1.
3. Update the local `isReturned` boolean to `vendorStatus === 'returned_to_vendor' || vendorStatus === 'returned_to_buyer'` so the existing branch already written for `returned_to_vendor` covers both cases without duplicating logic.

No backend, RLS, or edge-function changes are needed — the vendor row and documents are already saved and readable; only the client-side hydration gate is wrong.

## Verification

- Buyer opens Buyer Approval → Rejected → **Edit & Resubmit** on an on-behalf vendor rejected at Finance 1/2.
- Form opens on Review step with all previously entered data (GST no + declaration file, PAN + declaration, MSME, bank, addresses, contacts, classification) pre-filled.
- Buyer can edit any step, then resubmit; existing resubmit flow continues to work.

## Out of Scope

- No changes to status colors, EditUserDialog, or the earlier profile-update work.
- No changes to approval routing or backend policies.
