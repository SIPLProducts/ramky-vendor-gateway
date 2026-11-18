# Fix: Vendors Unable To Open Invitation And Returned-Application Links

## What happens today (confirmed in code)
1. **"Access Denied: This invitation is for a different email"** (your photo)
   - The registration page checks whether the person signed in on that browser matches the invited email.
   - If a different account is already signed in on that browser (a buyer, an old vendor, or another invitation), it shows Access Denied and stops. Incognito works because no one is signed in there.
   - The email check is also case-sensitive, so `Vendor@Abc.com` and `vendor@abc.com` are treated as different emails.
2. **"Unable to open invitation" (error 410)**
   - The link-opening service returns 410 when the invitation's expiry date has passed.
   - When a buyer or approver returns or rejects an application back to the vendor, the vendor is sent the same old link, but its expiry date is **not** extended. Older invitations have already expired by then, so the vendor cannot open the corrected application.

## Changes
All current features keep working the same way. Existing saved data is not changed.

1. **Switch account automatically on a wrong session**
   - When the signed-in account doesn't match the invitation, the portal signs that account out on this browser only.
   - It then restarts the normal invitation sign-in, the same flow Incognito uses. The vendor sees "Switching to the invited account…" instead of Access Denied.
   - The real "different email" denial from the server, for someone who isn't the invited person, still blocks as it does now.
2. **Email check ignores capital letters and extra spaces**, both in the browser and in the link-opening service.
3. **Returned/rejected applications get a fresh 14-day link**
   - When an application is sent back to the vendor for correction, the invitation's expiry date moves to 14 days from that moment.
   - This applies to buyer return-to-vendor and to the approval reject/return paths that email the vendor.
   - It only happens at the moment of the return, so existing records are not changed in bulk.
4. **Clearer expired message**
   - If a link really has expired, show "This Link Has Expired. Please Ask Your Buyer To Resend The Invitation" instead of the technical 410 text.
   - Show the buyer's name when it is known.

## Existing Production vendors who are stuck now
- Wrong-account cases are fixed as soon as the new build is deployed. The vendor just opens the same link again.
- Expired links: the buyer uses the existing "Extend/Resend" action on the Vendor Invitations screen. No bulk data change.

## Technical details
- `src/pages/VendorRegistration.tsx` (around line 554): compare `trim().toLowerCase()`. On mismatch, call `supabase.auth.signOut({ scope: 'local' })` and `navigate('/vendor/invite?token=…')`, with a sessionStorage guard against loops. Keep the hard denial when `claim-vendor-invite` returns `denied`.
- `src/pages/VendorInviteAccept.tsx`: same wrong-session handling before claiming; friendly expired copy.
- `supabase/functions/claim-vendor-invite`, `verify-invite-session`: normalise the email compare.
- `supabase/functions/buyer-return-to-vendor`, `sap-team-return-to-buyer` / reject paths that notify the vendor: set the latest invitation's `expires_at = now() + 14 days` (only when it would be earlier), then send the email.
- Redeploy the changed functions; self-hosted Production needs the frontend build and functions deployed. No migration.
