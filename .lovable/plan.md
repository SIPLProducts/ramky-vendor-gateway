## Goal
Stop the recurring `PayloadTooLargeError: request entity too large` during DMS document upload and make it obvious which middleware version/config is actually running on Windows.

## Plan
1. **Make the middleware limit fail-safe**
   - Increase the default middleware body parser limit beyond the current upload size.
   - Add a startup banner that always prints the active body limit and middleware version.
   - Add `/health` fields for `bodyLimit`, `middlewareVersion`, and current upload endpoint.

2. **Move the oversized-payload handler before normal route flow where Express can return JSON cleanly**
   - Keep the existing SAP payload shape unchanged:
     ```json
     {
       "BP_LIFNR": "0001061303",
       "FILE_UPLOAD": [
         { "FILE": "<base64>", "FILE_PATH": "..." }
       ]
     }
     ```
   - Return a clear JSON `413` response if the request is still too large instead of the HTML/stack trace page.

3. **Add hard proof that the correct local file is running**
   - Print a unique version line on startup, e.g. `Middleware build: dms-large-upload-v2`.
   - Update the Windows instructions so after copying the new `server.js`, you verify with:
     ```powershell
     curl http://localhost:3002/health
     ```
   - If `Body limit` / `middlewareVersion` is missing, it means Windows is still running an old `server.js` or a different folder/process.

4. **Reduce upload payload pressure from the cloud function**
   - Raise the current per-document gate in `sync-vendor-to-dms` only as needed, but keep a safe upper bound.
   - Improve error message shown to the app so it clearly says whether the failure happened in middleware body parsing or SAP.

5. **Document the exact restart steps**
   - Add a short “Repeated 413 fix” section in `middleware/README.md`:
     - stop all old Node processes on port `3002`
     - confirm the correct folder: `D:\middleware (2)\middleware`
     - set optional `.env`: `MIDDLEWARE_BODY_LIMIT=500mb`
     - restart: `node server.js`
     - verify `/health` includes the new version and body limit

## Important note
The log you shared does **not** show `Body limit: 200mb`, so the deployed Windows middleware is almost certainly still running an old copy of `server.js` or a different Node process/folder. This plan fixes the code and adds verification so we can prove the correct middleware is running before retrying DMS upload.