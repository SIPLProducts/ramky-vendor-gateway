## Goal
Wipe vendor submission and invitation data so you can re-create vendors from scratch. No schema, config, users, roles, tenants, mappings, approval matrix, branding, SAP/KYC settings, or other admin data will be touched.

## What will be deleted

From Lovable Cloud (same DB powers vms.siplproducts.com):

- `vendor_approval_progress` — 4 rows (approval chain progress)
- `vendor_documents` — 4 rows (uploaded document references)
- `vendor_validations` — 0 rows (KYC/GST validation history)
- `vendor_feedback` — 0 rows
- `ocr_extractions` — 0 rows
- `scheduled_validations` — 0 rows
- `audit_logs` where `vendor_id is not null` (vendor-scoped history only — login/role/admin logs preserved)
- `invitation_email_events` — 0 rows (Resend tracking)
- `vendor_invitations` — 28 rows
- `vendors` — 1 row

Storage: objects under the `vendor-documents` bucket tied to deleted vendors will be removed.

## What will NOT be touched

- Users, profiles, roles, custom roles, user-tenant assignments
- Tenants, buyer–SCM mappings, approval matrix levels & approvers
- Form/field configs, branding, SMTP, API providers/credentials, SAP configs/templates/master data
- Portal config, role permissions
- Audit logs not tied to a vendor

## Execution

Single transactional migration in dependency order:
1. Delete from child tables (`vendor_approval_progress`, `vendor_documents`, `vendor_validations`, `vendor_feedback`, `ocr_extractions`, `scheduled_validations`)
2. Delete vendor-scoped `audit_logs`
3. Delete `invitation_email_events` referencing invitations being removed
4. Delete `vendor_invitations`
5. Delete `vendors`
6. Remove storage objects in `vendor-documents` bucket

After this runs, the Vendor List, Approvals, and Invitations screens will all be empty and ready for fresh entries.

Confirm to proceed.