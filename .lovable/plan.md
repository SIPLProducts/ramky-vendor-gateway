## What is actually happening

- The browser payload in your screenshot is expected: `{"vendorIds": [...]}` is only the portal calling the backend function.
- The SAP DMS payload is created inside `sync-vendor-to-dms` and then sent from the backend to middleware as:

```json
{
  "BP_LIFNR": "1061301",
  "FILE_UPLOAD": [
    { "FILE": "BASE64", "FILE_PATH": "PATH1" },
    { "FILE": "BASE64", "FILE_PATH": "PATH2" }
  ]
}
```

- The recurring 413 is not because the browser payload is wrong. The latest logs show the middleware returned an old HTML Express error page:

```text
PayloadTooLargeError: request entity too large
```

That means the Windows middleware currently running on port `3002` is still an old instance/version. The new middleware should return JSON with `code: "PAYLOAD_TOO_LARGE"`, `middlewareVersion`, and `bodyLimit`; your log does not show that.

## Fix plan

1. **Make the SAP DMS payload explicit and verifiable**
   - Keep the portal request as `vendorIds`, because the frontend does not have the base64 documents.
   - In `sync-vendor-to-dms`, continue building the exact SAP payload with `BP_LIFNR` and `FILE_UPLOAD`.
   - Add safe debug output that logs `BP_LIFNR`, file count, file paths, batch number, and approximate MB size without printing base64 content.

2. **Make uploads smaller to avoid 413 even on older limits**
   - Reduce DMS batch size from about `40 MB` JSON to a much smaller safer value, around `8 MB`, because base64 increases file size and some old middleware/server layers may still have lower body limits.
   - If one single file is too large, return a clear message identifying that file instead of repeatedly failing the whole vendor sync.

3. **Improve middleware `/sap/dms/upload` validation and logs**
   - Validate the incoming body shape:
     - `BP_LIFNR` required
     - `FILE_UPLOAD` must be an array
     - each item must contain `FILE` and `FILE_PATH`
   - Log only safe metadata: vendor code, number of files, file paths, and estimated payload size.
   - Preserve SAP response exactly under `sapResponse`, so the success response like `File(s) Uploaded Successfully` is passed back cleanly.

4. **Add a health/version check before DMS upload**
   - Before uploading, call middleware `/health`.
   - If it does not show the expected new middleware version/body limit, return a clear message that the Windows middleware must be restarted/copied correctly instead of sending another large request that fails with HTML 413.

5. **Update Windows troubleshooting instructions**
   - Add exact commands to confirm the active middleware version and body limit:
     - open `/health`
     - confirm `middlewareVersion`
     - confirm `bodyLimit`
   - Add restart guidance for killing stale Node processes on port `3002`.

## Expected result after implementation

- In Chrome DevTools, the browser request will still show:

```json
{ "vendorIds": ["..."] }
```

- In backend/middleware logs, the actual SAP payload will be confirmed as:

```json
{
  "BP_LIFNR": "1061301",
  "FILE_UPLOAD": [
    { "FILE": "<base64 omitted from logs>", "FILE_PATH": "PATH1" }
  ]
}
```

- The app will avoid large single requests by sending small batches.
- If Windows is still running the old middleware, the app will tell you that directly before upload.
- SAP success rows will be returned back in the DMS result, including messages like `File(s) Uploaded Successfully`.