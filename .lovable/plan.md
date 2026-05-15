## Goal
Wipe all vendor submission/test data so the same email IDs (e.g., `sunilkumar@sharviinfotech.com`) can be re-invited and re-tested end-to-end. Keep all configuration, users, roles, branding, SMTP, SAP, approval matrix, and field configs untouched.

## What gets cleared
| Table | Rows now | After |
|---|---|---|
| `vendors` | 25 | 0 |
| `vendor_invitations` | 1 | 0 |
| `vendor_documents` | 51 | 0 |
| `vendor_validations` | 54 | 0 |
| `vendor_approval_progress` | 25 | 0 |
| `vendor_feedback` | 26 | 0 |
| `ocr_extractions` | 95 | 0 |
| `validation_api_logs` | 12 | 0 |
| `scheduled_validations` | 8 | 0 |
| `invitation_email_events` | 0 | 0 |
| `audit_logs` (only rows with `vendor_id IS NOT NULL`) | — | cleared |

## What is NOT touched
- `profiles`, `user_roles`, `user_tenants`, `user_custom_roles`, `custom_roles`
- `tenants`, `tenant_branding`
- `smtp_email_configs`, `api_credentials`, `api_providers`, `validation_configs`
- `approval_matrix_levels`, `approval_matrix_approvers`, `approval_workflows`, `approval_workflow_steps`, `buyer_scm_mappings`
- `sap_*` (configs, credentials, fields, master data, payload templates, defaults)
- `form_field_configs`, `form_step_configs`, `role_screen_permissions`, `custom_role_screen_permissions`, `portal_config`
- All Storage buckets / uploaded files in `vendor-documents` bucket remain (DB rows pointing to them are gone). If you also want the storage objects deleted, tell me and I'll add that step.

## Will it work after?
Yes. After the wipe:
1. Buyer (Sunil) → Vendor Invitations → "+ New Invitation" with the same email → fresh token → email goes via buyer SMTP (existing send-vendor-invitation logic, unchanged).
2. Vendor opens link → registers → 7-step form → Submit.
3. Approval pipeline (SCM Manager → SCM Head → Finance 1 → Finance 2 → SAP Sync) runs as configured — approval matrix and approver mappings are preserved.

No code, RLS, edge function, schema, or config changes. Single backend powers both preview and `vms.siplproducts.com`, so the reset applies to both — that is what you asked for.

## Execution (after approval)
One transactional batch via the data tool, in dependency-safe order:
```sql
DELETE FROM public.invitation_email_events;
DELETE FROM public.vendor_feedback;
DELETE FROM public.vendor_documents;
DELETE FROM public.vendor_validations;
DELETE FROM public.vendor_approval_progress;
DELETE FROM public.ocr_extractions;
DELETE FROM public.validation_api_logs;
DELETE FROM public.scheduled_validations;
DELETE FROM public.audit_logs WHERE vendor_id IS NOT NULL;
DELETE FROM public.vendor_invitations;
DELETE FROM public.vendors;
```
Then a `SELECT count(*)` per table to confirm zeros.
