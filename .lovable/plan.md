# Restore Buyer Registration Email

## Goal
Keep registration and SAP Sync emails disabled for vendors, while ensuring the inviting buyer continues receiving both notifications.

## Confirmed Current Behavior
- Registration still calls the buyer notification after saving the application.
- The buyer notification function still resolves the inviting buyer and sends to that buyer address only.
- The screenshot shows the application was submitted successfully, but the buyer notification function returned a non-success server response.
- The exact server-side mail failure is not visible in the screenshot, so the underlying mail/configuration error must be confirmed from the function response or Quality server logs before changing its cause.

## Changes
- Trace the buyer notification failure through the registration notification and shared SMTP sender.
- Fix the confirmed buyer-send failure without reintroducing the vendor as a recipient.
- Keep buyer resolution based on the invitation creator, with the existing tenant-admin fallback.
- Return a clear buyer-notification error instead of the generic “Edge Function returned a non-2xx status code,” while keeping registration submission successful.
- Preserve the buyer-only SAP Sync notification and all other email triggers.

## Verification
- Submit a registration and confirm the inviting buyer receives the email.
- Confirm the vendor receives no registration email.
- Complete a successful SAP Sync and confirm only the buyer receives the success email.
- Confirm registration remains saved if email delivery fails, with an accurate failure message and audit entry.
- Check diagnostics and deploy only the affected notification functions.

## Technical Details
- Review `notify-vendor-submission` and `send-smtp-email` responses together to identify the exact Quality failure.
- Do not restore the removed vendor-send block or add the vendor address to any recipient list.
- No database changes are planned unless diagnosis proves stored mail configuration data is the cause.
