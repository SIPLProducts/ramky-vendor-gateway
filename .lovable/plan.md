# Restore Buyer Registration and Rejection Emails

## Goal
Keep registration and SAP Sync emails disabled for vendors, while ensuring the inviting buyer receives registration, SAP Sync, and rejection notifications.

## Confirmed Current Behavior
- Registration still calls the buyer notification after saving the application.
- The buyer notification function still resolves the inviting buyer and sends to that buyer address only.
- The screenshot shows the application was submitted successfully, but the buyer notification function returned a non-success server response.
- The rejection screenshot shows the same generic non-success response while notifying the buyer at SCM CO rejection.
- Rejection paths still invoke the shared SMTP sender before completing the rejection, so removal of vendor registration/SAP emails did not intentionally remove rejection emails.
- The exact server-side mail failure is not visible in either screenshot, so the shared underlying mail/configuration error must be confirmed from function responses or Quality server logs before changing its cause.

## Changes
- Trace the buyer notification failure through the registration notification and shared SMTP sender.
- Trace SCM, Finance, CEO Office, and SAP Team rejection notifications through the same shared sender.
- Fix the confirmed buyer-send failure without reintroducing the vendor as a recipient.
- Keep buyer resolution based on the invitation creator, with the existing tenant-admin fallback.
- Return the actual safe mail error instead of “Edge Function returned a non-2xx status code” in both registration and rejection dialogs.
- Keep registration submission successful when its notification fails; preserve the existing reject-or-cancel decision when a rejection email fails.
- Preserve the buyer-only SAP Sync notification and all other email triggers.

## Verification
- Submit a registration and confirm the inviting buyer receives the email.
- Confirm the vendor receives no registration email.
- Reject at SCM CO and another downstream approval stage, confirming the inviting buyer receives the rejection email and the decision completes correctly.
- Confirm SAP Team rejection/return notifications still reach the buyer.
- Complete a successful SAP Sync and confirm only the buyer receives the success email.
- Confirm registration remains saved if email delivery fails, with an accurate failure message and audit entry.
- Check diagnostics and deploy only the affected notification functions.

## Technical Details
- Review `notify-vendor-submission`, approval rejection functions, and `send-smtp-email` responses together to identify the exact Quality failure.
- Do not restore the removed vendor-send block or add the vendor address to any recipient list.
- No database changes are planned unless diagnosis proves stored mail configuration data is the cause.
