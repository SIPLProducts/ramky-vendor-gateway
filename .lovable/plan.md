## Email Configuration Screen

A new admin screen at `/admin/email-config` to manage multiple SMTP credentials (one per sender email), shown in a table with Excel/PDF export.

### What you'll get

- Sidebar entry **Email Configuration** (icon: Mail), visible to `sharvi_admin`, `admin`, `customer_admin`.
- Form with: **User Email** (dropdown of registered portal users + free-text option), **SMTP Host**, **Port**, **Encryption** (TLS/SSL/STARTTLS/None), **App Password**, **From Name** (optional), **Active** toggle.
- Save / Update / Delete actions, plus **Test Send** button (sends a test email to the configured address using `send-smtp-email`).
- Table of saved configs: Email, Host, Port, Encryption, Active, Last Updated, Actions (Edit / Delete / Test).
- **Download Excel** (.xlsx) and **Download PDF** buttons that export the current table.
- App Password stored server-side; never shown after save (masked as `••••••••`, only re-entered when editing).

### Data model

New table `smtp_email_configs`:

```text
id              uuid pk
user_email      text  unique not null    -- the sender email this config belongs to
smtp_host       text  not null
smtp_port       int   not null  default 587
encryption      text  not null  default 'tls'   -- 'none'|'ssl'|'tls'|'starttls'
smtp_username   text  not null            -- usually = user_email
app_password    text  not null            -- stored server-side, never returned to client
from_name       text
is_active       boolean not null default true
created_by      uuid
created_at, updated_at  timestamptz
```

RLS: only `sharvi_admin`, `admin`, `customer_admin` can SELECT/INSERT/UPDATE/DELETE. The `app_password` column is excluded from any client-readable view; reads go through a SECURITY DEFINER RPC `list_smtp_configs()` that returns everything except the password.

### Edge functions

- `smtp-config-save` — upserts a row (writes `app_password` server-side using service role).
- `smtp-config-delete` — deletes by id.
- `smtp-config-test` — sends a test email through the existing `send-smtp-email` flow using an inline `smtp` override built from the row.

The existing global SMTP in `portal_config` stays untouched; this new table is additive and used when a per-sender override is needed.

### UI / Export

- Built with existing shadcn `Table`, `Dialog`, `Form`, `Select` components.
- Excel export via `xlsx` (SheetJS) — column headers match the table; password column omitted.
- PDF export via `jspdf` + `jspdf-autotable` — same columns; "Sharvi Vendor Portal — Email Configuration" header with timestamp.
- Follows project visual identity: grey bg, white rounded cards, blue primary accents.

### Files to add / change

- DB migration: create `smtp_email_configs`, RLS policies, RPC `list_smtp_configs()`.
- `src/pages/EmailConfiguration.tsx` — the new screen.
- `src/hooks/useSmtpConfigs.tsx` — CRUD + test hook.
- `src/App.tsx` — add `/admin/email-config` route.
- `src/components/layout/Sidebar.tsx` — add nav item with `screenKey: 'email_configuration'`.
- Seed `role_screen_permissions` for the new screen key for admin roles.
- `supabase/functions/smtp-config-save/index.ts`
- `supabase/functions/smtp-config-delete/index.ts`
- `supabase/functions/smtp-config-test/index.ts`
- `package.json` — add `xlsx`, `jspdf`, `jspdf-autotable`.

### Out of scope

- Auto-routing outbound mail through per-sender configs (the existing `send-smtp-email` continues to use the global config unless explicitly passed an override). Switching the default sender resolution can be a follow-up.