Make the requested wording changes in the vendor invitation flow.

## 1. "Create Vendor Invitation" popup (`src/pages/AdminInvitations.tsx`)

- In the `DialogDescription`, remove only the sentence: "They will use this link to create their account and submit their details." Keep the opening sentence so the description reads: "Send a registration link to a new vendor."
- Change the phone field label from "Phone Number" to "Contact Number" (popup only, line ~761).

## 2. Vendor registration invitation email (`supabase/functions/send-vendor-invitation/index.ts`)

- Remove the "Respectfully," line in the email signature block.
- Replace "Access Registration Portal" with "Access Registration Portal Using Below Link" in the registration process steps.

## Deploy step
- Deploy the `send-vendor-invitation` edge function so the email template changes take effect on the server.

No other UI or logic changes.