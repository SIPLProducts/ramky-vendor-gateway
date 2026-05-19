## Plan: Make DMS document upload succeed in SAP format

The payload format will stay exactly as SAP expects:

```json
{
  "BP_LIFNR": "0001061303",
  "FILE_UPLOAD": [
    { "FILE": "<base64>", "FILE_PATH": "..." }
  ]
}
```

The current failure is from the on-prem middleware parser before the request reaches SAP: `PayloadTooLargeError: request entity too large`.

### Implementation steps

1. **Raise middleware upload capacity**
   - Increase the default middleware body limit from `50mb` to `200mb`.
   - Keep it configurable using:
     ```env
     MIDDLEWARE_BODY_LIMIT=200mb
     ```
   - This allows larger base64 document batches while keeping the same SAP `FILE_UPLOAD` array.

2. **Expose the active limit clearly**
   - Print the active body limit on startup after `node server.js`.
   - Add `bodyLimit` to `/health` response so you can confirm the running middleware has the updated limit.

3. **Return proper JSON for oversized uploads**
   - Add middleware error handling for `PayloadTooLargeError` / `entity.too.large`.
   - Instead of an HTML error page, return clear JSON with the active limit and instruction to increase `MIDDLEWARE_BODY_LIMIT` if needed.

4. **Keep SAP-format upload logic unchanged**
   - Do not split files into multiple API calls.
   - Do not change `BP_LIFNR` or `FILE_UPLOAD` structure.
   - Continue sending all selected documents in the same request to `/sap/dms/upload`.

5. **Keep SAP response validation**
   - Validate the DMS response array using `MSGTYP === "S"`.
   - Mark upload successful only when SAP confirms success rows.
   - Surface SAP `MSG` in the app response.

6. **Update middleware restart notes**
   - Document the required Windows restart steps for `D:\middleware (2)\middleware`.
   - Include a `/health` verification command so you can confirm `bodyLimit: "200mb"` before retrying uploads.

### After implementation

You will need to restart the Windows middleware from the updated folder. If an old `server.js` process is still running, the same 413 error will continue.