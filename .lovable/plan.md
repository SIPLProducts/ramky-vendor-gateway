## Goal
Full wipe of **every vendor** in the system so you can start inviting fresh. Admin / buyer / finance / SCM / SAP users stay intact.

## What gets deleted
Executed in one migration (respects FKs):

1. `invitation_email_events` — all rows
2. `vendor_approval_progress` — all rows
3. `vendor_documents` — all rows
4. `vendor_validations` — all rows
5. `ocr_extractions` — rows tied to vendor uploads
6. `vendor_feedback` — all rows
7. `vendors` — all rows
8. `vendor_invitations` — all rows
9. `login_attempts` — rows for vendor emails
10. `user_custom_roles` / `user_roles` / `profiles` — rows for users whose role is `vendor`
11. `auth.users` — same set (users whose `user_roles.role = 'vendor'`)

## What is preserved
- Admin, buyer, finance_1, finance_2, scm_head, scm_manager, ceo_office, sap_team, sharvi_admin users
- Approval flow configs (`buyer_approval_flows`, `buyer_scm_mappings`)
- Tenants, SMTP configs, form configs, SAP configs
- Custom roles and screen permissions
- `vendor_reference_counters` (kept so new reference numbers keep incrementing; tell me if you want it reset too)

## Safety
- **Irreversible.** No backup taken.
- Any vendor currently mid-registration will be logged out and their data gone.
- If a vendor auth user was reused for something non-vendor (unlikely), it will still be deleted.

Reply approve and I'll run the migration. If you want to also reset `vendor_reference_counters` to start numbering from 001 again, say so and I'll add it.
