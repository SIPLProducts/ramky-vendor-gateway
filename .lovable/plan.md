# Copy Email Configuration from Quality to Lovable

## What gets copied
- **User email accounts** (Email Configuration list): host, port, encryption, username, app password, from name, active flag.
- **No-Reply email settings**: SMTP host, port, username, password, encryption, from email/name, reply-to, enabled.

Nothing else changes. Existing local entries with the same email are updated to match Quality; other local entries stay.

## Step 1 – You run this in Quality SQL Editor
```sql
select json_build_object(
  'smtp_email_configs', (select coalesce(json_agg(s), '[]') from public.smtp_email_configs s),
  'noreply', (select coalesce(json_agg(p), '[]') from public.portal_config p
              where p.config_key like 'smtp\_%')
) as export_data;
```
Export the result as CSV and upload it here.

## Step 2 – I import it
- Insert/update `smtp_email_configs` matched on `user_email`; `created_by` mapped to the local user with the same email (or left empty).
- Insert/update the `smtp_*` keys in `portal_config` matched on `config_key`.
- Passwords are copied as-is and never shown in chat.

## Step 3 – Check
- Confirm row counts match Quality.
- Open Email Configuration to see the list; you can use "Send Test" to confirm sending works.

## Note
Quality's mail server must be reachable from Lovable for test emails to succeed; if it is an internal-only server, the settings copy fine but sending from here may fail.
