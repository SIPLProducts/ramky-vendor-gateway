

## Email Body Preview

Here is the exact HTML email body that the `send-vendor-invitation` Edge Function sends. After the fix (removing `mimeContent` and letting `denomailer` handle encoding natively), this will render correctly in all email clients.

### Visual Layout

```text
┌─────────────────────────────────────────────────────┐
│         BLUE GRADIENT HEADER (#2563eb)              │
│                                                     │
│           Sharvi Vendor Portal                      │
│          Vendor Management System                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│  You're Invited to Register                         │
│                                                     │
│  Hello,                                             │
│                                                     │
│  You have been invited to register as a vendor      │
│  on the Sharvi Vendor Portal. Please click the      │
│  button below to create your account and            │
│  complete your vendor registration.                 │
│                                                     │
│          ┌────────────────────┐                      │
│          │ Start Registration │  (blue button)       │
│          └────────────────────┘                      │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ ⚠️ Important: This invitation link expires   │    │
│  │ on 5 May 2026. Please complete your          │    │
│  │ registration before this date.               │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  If the button doesn't work, copy this link:        │
│  https://ramkyvms.netlify.app/vendor/invite?token=… │
│                                                     │
│  ─────────────────────────────────────────────      │
│  This is an automated message from Sharvi Vendor    │
│  Portal. If you did not expect this invitation,     │
│  please ignore this email or contact                │
│  support@sharviinfotech.com.                        │
└─────────────────────────────────────────────────────┘
```

### Raw HTML Email Body (what the function sends)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
  Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px;
  margin: 0 auto; padding: 20px;">

  <!-- Blue gradient header -->
  <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">
      Sharvi Vendor Portal
    </h1>
    <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;
      font-size: 14px;">Vendor Management System</p>
  </div>

  <!-- Body content -->
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb;
    border-top: none; border-radius: 0 0 12px 12px;">

    <h2 style="color: #1f2937; margin-top: 0;">
      You're Invited to Register
    </h2>
    <p>Hello,</p>
    <p>You have been invited to register as a vendor on the Sharvi Vendor
       Portal. Please click the button below to create your account and
       complete your vendor registration.</p>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://ramkyvms.netlify.app/vendor/invite?token=TOKEN"
         style="background: #2563eb; color: white; padding: 14px 28px;
         text-decoration: none; border-radius: 8px; font-weight: 600;
         display: inline-block;">
        Start Registration
      </a>
    </div>

    <!-- Expiry warning -->
    <div style="background: #fef3c7; border: 1px solid #f59e0b;
      border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>⚠️ Important:</strong> This invitation link expires on
        <strong>5 May 2026</strong>. Please complete your registration
        before this date.
      </p>
    </div>

    <!-- Fallback link -->
    <p style="color: #6b7280; font-size: 14px;">
      If the button above doesn't work, copy and paste this link:
    </p>
    <p style="background: #f3f4f6; padding: 12px; border-radius: 6px;
      word-break: break-all; font-size: 12px; color: #4b5563;">
      https://ramkyvms.netlify.app/vendor/invite?token=TOKEN
    </p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <!-- Footer -->
    <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">
      This is an automated message from Sharvi Vendor Portal. If you did
      not expect this invitation, please ignore this email or contact
      support@sharviinfotech.com.
    </p>
  </div>
</body>
</html>
```

### What was fixed

The `send-smtp-email` Edge Function previously set `transferEncoding: "base64"` in a manual `mimeContent` block but passed raw (unencoded) HTML. Email clients tried to decode the raw text as base64, producing garbled characters.

The fix removes `mimeContent` entirely and passes `content` (plain text) and `html` directly to `denomailer`, which handles encoding automatically. This is already deployed.

No further code changes are needed -- the fix was applied in the previous approved plan.

