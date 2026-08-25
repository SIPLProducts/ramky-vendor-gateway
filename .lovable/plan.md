# Fix support email in all outgoing emails

The app code already uses `vyapaarsupport@ramky.com` everywhere. The invitation email in your screenshot still shows `vendxsupport@ramky.com` because that address is stored in the tenant branding record ("help email") in the server database, and the invitation email uses that stored value instead of the built-in one.

## What will be done

1. Clean the stored value
   - Update the tenant branding help email in the database: any value containing `vendx` is replaced with `vyapaarsupport@ramky.com`.
   - Provide the same SQL so it can be run on the self-hosted server database.

2. Guard against the old address in code
   - In the invitation email and the invite sign-in link email, ignore any stored help email that still contains `vendx` and fall back to `vyapaarsupport@ramky.com`.
   - Keeps working normally for any properly configured branding address.

3. Add the support line where it is missing
   - Vendor submission email: already shows the support address (no change needed).
   - Rejection / return-to-vendor emails and the SAP sync notification email currently have no support contact line. Add a consistent footer:
     "For any queries, please contact vyapaarsupport@ramky.com" — using the same resolved support address logic.
   - Status notification email footer still shows the placeholder `vendor.support@company.com`; replace it with the correct support address.

4. Redeploy the affected email functions so the server picks up the change.

## Technical notes

Files: `supabase/functions/send-vendor-invitation/index.ts`, `send-invite-signin-link/index.ts`, `notify-vendor-submission/index.ts`, `send-status-notification/index.ts`, `sap-team-reject-vendor/index.ts`, `sap-team-return-to-buyer/index.ts`, `buyer-return-to-vendor/index.ts`, `sync-vendor-to-sap/index.ts`, plus one data migration for `tenant_branding.help_email`.

No workflow, validation, or data-model changes — email copy and configuration only.
