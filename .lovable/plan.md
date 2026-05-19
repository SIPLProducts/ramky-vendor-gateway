## Root cause

The same SAP URL can accept different business payloads and return different response shapes. The app currently treats DMS as a separate middleware route problem and keeps trying:

```text
/sap/dms/upload
/dms/upload
/sap/dms
/sap/upload
```

Your working setup is different: the middleware route that exists is `/sap/bp/create`, and SAP behavior is determined by the payload sent to the target URL:

```json
{
  "BP_LIFNR": "1061301",
  "FILE_UPLOAD": [
    { "FILE": "BASE64", "FILE_PATH": "PATH1" }
  ]
}
```

So we must not assume same URL means same payload/response. We should route by operation type and payload shape.

## Plan

1. **Add operation-aware routing in `sync-vendor-to-dms`**
   - Detect DMS upload payload by shape: top-level `BP_LIFNR` plus `FILE_UPLOAD` array.
   - For this DMS payload, send it through the existing middleware BP route:
     ```text
     POST {middlewareUrl}/sap/bp/create
     ```
   - Do not convert this DMS payload into the normal BP creation array payload.

2. **Keep SAP BP creation and DMS upload separate in code**
   - `sync-vendor-to-sap` will continue using the normal BP creation payload and parsing `ACC_RES`.
   - `sync-vendor-to-dms` will use the DMS payload and parse the flat SAP DMS rows.
   - Even if both operations use the same SAP target URL, their request/response handling will remain separate.

3. **Remove incorrect DMS route dependency**
   - Stop failing only because `/sap/dms/upload` does not exist on the running middleware.
   - Keep `/sap/dms/upload` support only as optional compatibility for newer middleware, but make `/sap/bp/create` the working fallback for your current middleware.

4. **Return SAP’s dynamic DMS response exactly**
   - If SAP returns:
     ```json
     [
       {
         "BP_LIFNR": "0001061303",
         "MSGTYP": "S",
         "MSGNR": "200",
         "MSG": "File(s) Uploaded Successfully"
       }
     ]
     ```
   - The function will set:
     - `success: true`
     - `message` from SAP `MSG`
     - `sap` as the first success row
     - `sapRows` as the full returned array

5. **Make diagnostics clearer**
   - Logs will show the operation as `DMS payload via /sap/bp/create`.
   - Failure messages will distinguish:
     - middleware route not found
     - SAP HTTP error
     - SAP returned `MSGTYP !== "S"`
     - SAP returned no DMS rows

## Expected result

The application will send the exact DMS payload that works in Postman through the existing working middleware route, and it will return SAP’s dynamic DMS response rows instead of repeatedly failing on missing `/sap/dms/upload` paths.