The new error confirms the old Storage RLS problem is bypassed now. The current failure is self-host edge runtime booting `upload-vendor-document` and not finding a valid function entrypoint:

```text
InvalidWorkerCreation: worker boot error: failed to bootstrap runtime: could not find an appropriate entrypoint
```

That means production does not have the new function folder deployed correctly, or the self-host runtime cannot detect its `index.ts` entrypoint.

## Plan

1. **Harden the new upload function entrypoint**
   - Update `upload-vendor-document` to follow the same entrypoint pattern as the existing working self-host functions.
   - Use an explicit `serve(...)` import style and local CORS headers consistent with the rest of this project.
   - Keep the existing authorization logic for both:
     - email invitation vendors
     - Create Vendor / on-behalf buyers

2. **Improve frontend error display**
   - Update the upload caller so a backend JSON error like `InvalidWorkerCreation` is shown clearly instead of only:
     ```text
     Edge Function returned a non-2xx status code
     ```
   - This helps confirm the exact server-side issue immediately from the toast.

3. **Fix self-host deployment coverage**
   - Update the self-host deploy script so it verifies that the deployed functions directory contains:
     ```text
     upload-vendor-document/index.ts
     ```
   - This prevents frontend code from calling a function that was not actually copied into the self-host backend volume.

4. **Add safe function diagnostics**
   - Add non-secret logs for the upload function stages:
     - function reached
     - user authenticated
     - vendor access checked
     - storage upload attempted
     - metadata saved
   - No keys, tokens, or file contents will be logged.

5. **Production deploy requirement**
   - After implementation, this must be deployed to the self-host server backend functions volume and the functions container must be restarted.
   - Publishing/updating only the frontend is not enough for this error because the failing part is the backend function runtime.

## Expected Result

The request to:

```text
/supabase/functions/v1/upload-vendor-document
```

will boot correctly and process uploads through the backend for both email-link and on-behalf vendor flows.