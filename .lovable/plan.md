## Issue

In the invitation email signature, the sender's name (e.g., "sureshmareddy") is rendered in **italic Georgia serif**, which looks awkward — especially for lowercase usernames.

## Fix

In `supabase/functions/send-vendor-invitation/index.ts` line 210, replace the styling of the sender-name span:

- Remove italic Georgia serif
- Use the same sans-serif stack as the rest of the email
- Bump font-size to 15px, font-weight 600
- Apply `text-transform: capitalize` so "sureshmareddy" displays as "Sureshmareddy"

```html
<span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; font-size:15px; font-weight:600; color:#1e3a5f; text-transform:capitalize;">Procurement Team</span>
```

The runtime replacement at line 344 (`emailHtml.replace("Procurement Team", senderName)`) keeps working because the literal placeholder text is unchanged.

No other files need changes.