## Confirmed understanding

- **Lovable preview / `vms.siplproducts.com` is working.**
- The issue is on your **self-hosted server deployment** (`10.200.1.7` / deployed server build).
- So the fix must make the code work even when the server database/config is not identical to Lovable Cloud.

## Actual issue

### SAP Sync
The SAP API is not hitting because payload building fails first:

`No SAP payload template configured`

That means the server database is missing or not exposing the active `sap_payload_templates` row. So the code stops before calling the configured SAP API.

### GST upload
The GST upload flow depends too much on OCR reading GSTIN from PDF. On the self-hosted server, OCR returns `No GSTIN Detected`, so the flow blocks instead of falling back to the GSTIN/manual validation path.

## Fix I will implement

### 1. SAP Sync fallback for self-hosted server
Files:
- `src/lib/sapPayloadBuilder.ts`
- `supabase/functions/sync-vendor-to-sap/index.ts`

Changes:
- Keep current working template-based payload if `sap_payload_templates` exists.
- If no active template exists, dynamically build the SAP payload from the configured **SAP API Settings → Request Fields** rows.
- Use dynamic values from:
  - vendor fields
  - SAP confirmation dialog overrides
  - tenant SAP default fields
  - configured request-field defaults
- Continue using the configured SAP API endpoint/middleware URL from SAP API Settings.
- No hardcoded vendor data, endpoint, or credentials.

### 2. Better SAP config selection
Files:
- `src/lib/sapPayloadBuilder.ts`
- `supabase/functions/sync-vendor-to-sap/index.ts`

Changes:
- Prefer the config named like `Create vendor in SAP` or endpoint containing `/vendor/bp/create` / `/sap/bp/create`.
- Avoid accidentally choosing other active SAP configs like `Tenants From SAP`.

### 3. GST upload fallback
Files:
- `src/components/vendor/kyc/GstKycTab.tsx`
- `src/components/vendor/steps/DocumentVerificationStep.tsx`
- `src/lib/kycExtract.ts`

Changes:
- If GST OCR cannot detect GSTIN from the PDF, use the already-entered/manual GSTIN if available and call the configured GST validation API.
- If no GSTIN is available, show a clear message to enter GSTIN manually instead of only saying upload clearer PDF.
- Improve extraction from Surepass OCR response so nested OCR fields are handled more safely.

### 4. Server deployment safety
I will also update the deployment/server notes if needed so the self-hosted server deploy includes:
- latest frontend build
- latest backend functions
- required seed/config parity for SAP payload template when available

## Expected result

- SAP Sync will actually call the configured SAP API on the self-hosted server.
- GST PDF upload will not dead-end when OCR cannot detect GSTIN.
- Existing working behaviour on Lovable / `vms.siplproducts.com` remains unchanged.