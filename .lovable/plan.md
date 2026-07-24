## Plan

1. **Harden function deployment verification**
   - Update the self-host deploy script to verify multiple critical function entrypoints after sync, including:
     - `upload-vendor-document/index.ts`
     - `kyc-api-execute/index.ts`
   - Add a clear failure message if the production functions volume does not contain these files in the exact runtime-expected layout.

2. **Fix self-host function container restart/recreate path**
   - Update the deploy script to recreate the functions container after syncing functions, not only restart it.
   - This ensures the self-host edge runtime sees newly copied function folders and shared files.
   - Keep the existing self-host compose paths configurable for DEV/PROD using `APP_ROOT`, `BACKEND_DIR`, and `FN_DST`.

3. **Add a production diagnostics script/section**
   - Add copy-paste checks for the server to confirm:
     - the deployed function files exist under the backend functions volume
     - the functions container has the same files mounted internally
     - the container logs show whether the runtime is reading the correct functions path
   - This directly targets the `InvalidWorkerCreation: could not find an appropriate entrypoint` failure.

4. **Keep function source compatible**
   - Confirm both affected functions use the self-host-compatible `serve(...)` entrypoint pattern.
   - Avoid changing business logic in `kyc-api-execute` or document upload unless the diagnostics show a source-level problem.

5. **Expected result**
   - Production calls to:
     - `/supabase/functions/v1/upload-vendor-document`
     - `/supabase/functions/v1/kyc-api-execute`
   - should no longer fail with `InvalidWorkerCreation`.
   - If a request is invalid or unauthorized, it should return a normal JSON error from the function instead of a worker boot error.