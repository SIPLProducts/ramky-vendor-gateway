# Submission Success Popup + Improved Email Body

## 1. Return buyer info from `notify-vendor-submission`

Edge function `supabase/functions/notify-vendor-submission/index.ts`:

- On successful send, return the inviter's name + email in the response:
  ```json
  { "success": true, "sentTo": "...", "inviter": { "name": "Buyer Name", "email": "buyer@x.com" } }
  ```
- On skip cases (`no_invitation`, `no_inviter`, `no_inviter_email`), keep returning `success: true` but without `inviter`.

## 2. Enrich the email body

In `buildHtml(...)` add a vendor details block containing:

- Vendor Name (legal/trade)
- Vendor Email (`primary_email`)
- Vendor Contact Number (fetch `primary_phone` from `vendors`)
- Vendor Unique ID (existing `vendor.id`, plus short ref code if available)
- Submitted Date & Time (formatted IST)

Update the SELECT in the function to also pull `primary_phone` and any short reference code column on `vendors`. Keep the existing Sharvi-styled (navy header + gold accent) layout, just expand the details table and tighten copy. No other layout changes.

## 3. Submission flow change in `useVendorRegistration.tsx`

In `submitVendorMutation`:

- `await` the `notify-vendor-submission` invoke (already awaited).
- Capture `notifyData` and attach it to the returned vendor object, e.g. `return { ...vendor, _notify: notifyData };`
- Remove the generic success toast from `onSuccess` (popup will replace it).

## 4. Success popup in `src/pages/VendorRegistration.tsx`

In `handleSubmit`:

- After `submitVendor`/`resubmitVendor` resolves, read `_notify`.
- If `_notify?.success && _notify?.inviter?.email`, open a new `SubmissionSuccessDialog` with:
  > "Application submitted successfully. Submission details have been sent to the respective buyer who sent the invitation: **{inviter.name}** ({inviter.email})."
- If notify was skipped or failed, show a softer variant:
  > "Application submitted successfully. The buyer notification could not be sent automatically — our team has been informed."
- Only after the user closes this dialog, transition to the existing `SuccessScreen` view (`setIsSubmitted(true)`).

New component: `src/components/vendor/SubmissionSuccessDialog.tsx` — shadcn `Dialog`, success icon, the message, single "Continue" button. Uses semantic tokens only.

## 5. Files touched

- `supabase/functions/notify-vendor-submission/index.ts` — return inviter info, expand email body with vendor details (name, email, phone, ID, submitted at).
- `src/hooks/useVendorRegistration.tsx` — propagate notify result, drop duplicate toast.
- `src/pages/VendorRegistration.tsx` — gate `SuccessScreen` behind new dialog; show buyer name/email from notify response.
- `src/components/vendor/SubmissionSuccessDialog.tsx` — new component.

No DB schema changes. Edge function will be auto-deployed.
