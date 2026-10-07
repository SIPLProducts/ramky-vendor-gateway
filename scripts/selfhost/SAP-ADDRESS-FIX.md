# SAP registered address correction

Deploy the current frontend build and the updated functions together to Quality first, then Production using the existing `deploy-latest.sh` workflow. A frontend `dist` replacement alone does not deploy the function.

Required function files:
- `supabase/functions/sync-vendor-to-sap/index.ts`
- `supabase/functions/_shared/sap-registered-address.ts`

No database migration, blanket permission change, or historical data backfill is required. Restart only the functions service for the target environment after deploying its function files.

## Acceptance check

1. Sign in as an authorized SAP user and select a pending vendor.
2. Compare Organization & Contact State with SAP Field Confirmation State: both should show the saved organization state name, never the full GST jurisdiction.
3. Confirm address edits and sync using a Quality/test SAP destination.
4. Read the vendor again: confirmed registered address/contact values must be saved, State must be clean, and GST jurisdiction/KYC/documents must remain unchanged.
5. Verify SAP root and nested vendor `region` use the confirmed state mapping (Telangana `36`, Karnataka `10`).
6. An invalid/empty State must stop before saving or contacting SAP. A denied vendor read or failed address save must also stop sync.

Saving a valid address happens before the SAP request; an upstream SAP failure does not undo the confirmed address edit. Existing accepted KYC documents are never changed by this operation.

Local state/address regression checks passed. Authenticated save and SAP end-to-end verification remain unverified: the requesting account cannot access the SAP screen. No Production deployment or real SAP transaction was performed.