## Plan

1. **Remove the hardcoded old-middleware blocker**
   - In `sync-vendor-to-dms`, stop returning this fixed message before upload:
     `Old middleware is running. /health must show middlewareVersion...`
   - Keep `/health` as diagnostic information only, so the upload response is based on the real `/sap/dms/upload` result.

2. **Make the DMS response dynamic**
   - If middleware `/health` returns `{}` or has missing fields, include that information in logs/metadata, but do not fail immediately.
   - Return the actual middleware/SAP response for each upload batch, including real HTTP status and error body when available.
   - Preserve SAP-oriented response fields like `BP_LIFNR`; do not expose internal vendor UUIDs in the result.

3. **Improve too-large-payload handling**
   - Keep batching, but make payload-size errors come from the actual request result instead of a pre-check version gate.
   - When a batch is too large, return a clear dynamic message showing which batch failed, status `413`, and the middleware error body if it exists.

4. **Clean the middleware docs if needed**
   - Update the README wording that currently says the browser payload only shows `vendorIds`, because the current flow is intended to show the SAP-format payload.

## Expected result

Browser Inspect will send/show the SAP DMS shape:

```json
{
  "BP_LIFNR": "1061301",
  "FILE_UPLOAD": [
    { "FILE": "BASE64", "FILE_PATH": "PATH1" }
  ]
}
```

And the response will be dynamic from the upload attempt, not the hardcoded old-middleware message.