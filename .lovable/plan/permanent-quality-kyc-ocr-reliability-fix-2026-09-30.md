# Permanent Quality KYC/OCR Reliability Fix

## Scope

- Preserve required backend access to KYC provider configuration through an idempotent migration.
- Distinguish a genuinely missing provider from backend URL, credential, authorization, and query failures.
- Add safe diagnostics that never print service credentials or provider tokens.
- Add Quality deployment verification that detects provider-read failures immediately.
- Leave Production unchanged until GST, PAN, and Bank OCR are verified in Quality.

## Implementation

1. Update the KYC execution function to validate required environment configuration, retain provider and credential query errors, emit safe diagnostic codes, and keep the existing successful OCR behavior unchanged.
2. Add a migration granting the service role only the table access needed by KYC execution and reload the API schema cache.
3. Extend the self-host diagnostic script with database-level checks for the active OCR rows, grants, and function container environment metadata without exposing secrets.
4. Extend the deployment script to verify the migration state and call the deployed KYC function with a non-file probe that confirms provider lookup succeeds without contacting the external OCR service.
5. Record the reliability rule and update the project roadmap.

## Verification

- Validate shell syntax and source formatting.
- Confirm the migration is idempotent and contains explicit grants.
- Confirm the function reports safe, specific errors and never logs credentials.
- Check the preview build diagnostics after edits.
- Deploy and test only in Quality; Production deployment remains a separate, later decision.
