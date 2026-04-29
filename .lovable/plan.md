# Update Email Configuration to match SMTP layout

Bring the existing `/admin/email-config` screen in line with the uploaded SMTP Email Configuration design while keeping the multi-config table + Excel/PDF exports already in place.

## New / changed fields

The Add/Edit dialog will be expanded to the full set shown in the screenshot:

| Field | Notes |
|---|---|
| Enable SMTP Sending | Toggle (maps to `is_active`). When off, system falls back to default provider. |
| SMTP Host | existing |
| Port | existing — auto-suggest 465/587 based on encryption |
| Encryption | dropdown: SSL (465), TLS (587), STARTTLS (587), None |
| Use App Password | Toggle (UI-only hint that switches password label/help text) |
| Username | existing `smtp_username` |
| App Password | existing, with show/hide eye toggle |
| From Email | NEW — `user_email` doubles as From Email; relabel + autofill from Username |
| From Name | existing, default "Sharvi Vendor Portal" |
| Reply-To (optional) | NEW field `reply_to` |
| Provider hint box | static helper text for Gmail / Outlook 365 |
| Send test to + Send Test Email | inline test sender (uses entered values without saving) |

The list table and exports remain unchanged (still show Email/Host/Port/Encryption/Status/Updated and export to Excel/PDF).

## Database

Add one nullable column to `public.smtp_email_configs`:

```sql
alter table public.smtp_email_configs
  add column if not exists reply_to text;
```

No other schema changes — `is_active`, `from_name`, `app_password`, `smtp_username`, `user_email` already exist and cover the rest of the form.

`list_smtp_configs` RPC will be updated to return `reply_to` as well.

## Edge functions

- `smtp-config-save`: accept and persist `reply_to`.
- `smtp-config-test`: accept an optional inline payload `{ host, port, encryption, username, app_password, from_email, from_name, reply_to, send_to }` so the form can run a test before the row is saved (in addition to the existing "test by id" path used from the table).

## Frontend changes (`src/pages/EmailConfiguration.tsx` + `src/hooks/useSmtpConfigs.tsx`)

1. Replace the current dialog body with a 2-column layout matching the screenshot:
   - Top banner row: **Enable SMTP Sending** switch with helper text.
   - Row 1: SMTP Host | Port
   - Row 2: Encryption | Use App Password toggle
   - Row 3: Username | App Password (with eye show/hide)
   - Row 4: From Email | From Name
   - Row 5: Reply-To (full width)
   - Helper card: Gmail + Outlook/Office 365 instructions.
   - Footer right: "Send test to" input + **Send Test Email** button (calls `smtp-config-test` with the unsaved form values).
2. When Encryption changes, auto-set Port (465 for SSL, 587 for TLS/STARTTLS) unless the user has manually edited it.
3. Keep dropdown of existing user emails for the From Email field plus free-text entry.
4. Update `SmtpConfigInput` / `SmtpConfig` types to include `reply_to`.
5. Add `reply_to` to the export rows and PDF/Excel columns.

## Out of scope

- No change to roles, RLS, or sidebar entry.
- No change to how outbound mail (`send-smtp-email`) currently picks credentials — that can be wired to active rows in a follow-up.
