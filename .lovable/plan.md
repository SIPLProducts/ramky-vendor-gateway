I found the source of the visible `reply-to: bala@sharviinfotech.com` header in the vendor registration email flow.

## Plan

1. Update the vendor invitation email sender
   - In `send-vendor-invitation`, keep using the configured user email as the `From` address.
   - Explicitly prevent any `reply_to` / `Reply-To` value from being passed when sending vendor registration invitations.

2. Update the shared SMTP sender to respect “no reply-to”
   - Adjust `send-smtp-email` so that if an email request explicitly says not to use Reply-To, it will not fall back to the global Reply-To setting from Email Configuration.
   - This avoids the global `smtp_reply_to` / configured Reply-To value being added automatically to vendor registration emails.

3. Keep other email behavior unchanged
   - Other SMTP emails can continue using their configured Reply-To if needed.
   - Only vendor registration invitation emails will suppress the Reply-To header.

4. Deploy updated backend functions
   - Redeploy the affected backend functions so the next vendor registration email no longer shows a Reply-To line in Gmail’s message details.

## Expected result

New vendor registration invitation emails should show:

```text
from: Ramky Vendor Portal <suresh.mareddy@ramky.com>
to: recipient@example.com
subject: Vendor Registration Invitation - ...
```

and should no longer show:

```text
reply-to: bala@sharviinfotech.com
```