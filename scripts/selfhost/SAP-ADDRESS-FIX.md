# SAP registered address correction

Deploy the current frontend build and the updated functions together to Quality first, then Production using the existing `deploy-latest.sh` workflow. A frontend `dist` replacement alone does not deploy the function.

Required function files:
- `supabase/functions/sync-vendor-to-sap/index.ts`
- `supabase/functions/_shared/sap-registered-address.ts`
- `supabase/functions/sync-vendors-to-sap-bulk/index.ts`
- `supabase/functions/_shared/sap-location.ts`
- `supabase/functions/dashboard-approvers/index.ts` and `routing.ts`
- `supabase/functions/process-approval-action/index.ts`
- `supabase/functions/sap-team-return-to-buyer/index.ts`
- `supabase/functions/sap-team-reject-vendor/index.ts`
- `supabase/functions/send-status-notification/index.ts`
- `supabase/functions/_shared/vendor-email-identity.ts`

No database migration, blanket permission change, or historical data backfill is required. Restart only the functions service for the target environment after deploying its function files.

## Acceptance check

1. Sign in as an authorized SAP user and select a pending vendor.
2. Compare Organization & Contact State with SAP Field Confirmation State: both should show the saved organization state name, never the full GST jurisdiction.
3. Confirm address edits and sync using a Quality/test SAP destination.
4. Read the vendor again: confirmed registered address/contact values must be saved, State must be clean, and GST jurisdiction/KYC/documents must remain unchanged.
5. Verify SAP root and nested vendor `region` use the confirmed state mapping (Telangana `36`, Karnataka `10`).
6. An invalid/empty State must stop before saving or contacting SAP. A denied vendor read or failed address save must also stop sync.
7. Verify `location` is empty at the root and inside every vendor entry for single/bulk sync, while `region` and all four address lines remain unchanged.
8. On Dashboard, the current review badge must display the routed approver name below it; search and Excel export must include that name.
9. Rejection/return emails must display the saved `reference_number`, never a short UUID or SAP code. Use a Quality/test mailbox to avoid real rejection notifications during testing.

Saving a valid address happens before the SAP request; an upstream SAP failure does not undo the confirmed address edit. Existing accepted KYC documents are never changed by this operation.

Local state/address regression checks passed. Authenticated save and SAP end-to-end verification remain unverified: the requesting account cannot access the SAP screen. No Production deployment or real SAP transaction was performed.

The subsequent location/dashboard/reference corrections passed seven focused tests. The connected preview dashboard showed a real SCM CO assignment, assigned-name search returned the correct application, and the downloaded Excel contained Current Approver. The updated functions were deployed to the connected preview backend. Self-hosted Quality/Production deployment and real email/SAP destination checks remain outstanding.