## Clear Vendor Test Data

Wipe all vendor-related records so fresh registrations can be submitted. No schema, config, workflow, DMS, or SAP integration changes.

### Tables to clear
- `vendor_feedback` (4 rows)
- `vendor_validations` (5 rows)
- `vendor_approval_progress` (15 rows)
- `vendor_documents` (24 rows)
- `ocr_extractions` (0 rows)
- `invitation_email_events` (0 rows)
- `vendor_invitations` (17 rows)
- `vendors` (9 rows)
- `audit_logs` rows where `vendor_id IS NOT NULL` (vendor-specific audit history only; user/system logs preserved)

### Not touched
- Configuration: `approval_matrix_*`, `approval_workflows*`, `form_*_configs`, `portal_config`, `tenant_branding`, `buyer_scm_mappings`
- SAP: `sap_api_configs`, `sap_api_credentials`, `sap_api_request_fields`, `sap_api_response_fields`, `sap_default_fields`, `sap_master_data`, `sap_payload_templates`
- Users/roles: `profiles`, `user_roles`, `user_tenants`, `user_custom_roles`, `custom_roles`, `tenants`
- Storage bucket `vendor-documents` (file objects) — left as-is; orphaned files are harmless and overwritten on new uploads. Tell me if you want those purged too.
- Auth users — preserved

### Order (respects FKs)
DELETE in this order in a single transaction:
1. `vendor_feedback`
2. `vendor_validations`
3. `vendor_approval_progress`
4. `vendor_documents`
5. `ocr_extractions`
6. `invitation_email_events`
7. `audit_logs WHERE vendor_id IS NOT NULL`
8. `vendor_invitations`
9. `vendors`

Executed via the data-change tool (no migration, no schema change).
