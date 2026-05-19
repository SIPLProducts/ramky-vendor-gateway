## Why this is happening

Your latest logs show:

```text
GET /health 200
POST /sap/dms/upload 404
Cannot POST /sap/dms/upload
```

That means Lovable Cloud is reaching the middleware, but the **running middleware process does not have the `/sap/dms/upload` route registered**. So this is not a SAP success/failure response yet; it is Express returning 404 before forwarding to SAP.

The desired dynamic response can only come after the request reaches the middleware DMS route and the middleware forwards it to SAP.

## Plan

1. **Make the middleware route more robust**
   - Keep `POST /sap/dms/upload`.
   - Add safe alias routes for common deployment/path mistakes, such as `POST /dms/upload` and `POST /sap/dms`.
   - Add a JSON 404 handler that returns available endpoints and middleware version instead of an HTML `Cannot POST ...` page.
   - This makes future errors clear and dynamic instead of browser/Express HTML.

2. **Return SAP DMS rows directly in the middleware**
   - When SAP returns the array:
     ```json
     [{ "BP_LIFNR": "0001061303", "MSGTYP": "S", "MSG": "File(s) Uploaded Successfully" }]
     ```
   - The middleware response will preserve that array under `sapResponse` and expose diagnostic metadata only outside it.

3. **Improve Edge Function parsing and result output**
   - Keep sending payload as:
     ```json
     { "BP_LIFNR": "1061307", "FILE_UPLOAD": [...] }
     ```
   - Parse middleware `sapResponse` dynamically.
   - If SAP returns success rows, mark the vendor success and include the exact SAP row in `sap` / `sapRows`.
   - If middleware returns 404/413/502, show the real status and body, but no longer expose internal vendor UUIDs.

4. **Fix outdated configuration normalization**
   - Update frontend middleware URL cleanup to strip `/sap/dms/upload` too, so saving a full endpoint URL does not accidentally create wrong paths later.

5. **Update troubleshooting docs**
   - Remove the outdated README line that says browser Inspect only shows `vendorIds`.
   - Document that current DMS flow sends the SAP-format payload in Inspect.
   - Add a clear verification step: `/health` must list `POST /sap/dms/upload` or the running middleware file is old/wrong.

## Expected result

After implementing and restarting the middleware with the updated `server.js`, `/health` and 404 responses will clearly show whether DMS route exists. A successful DMS sync will return dynamic SAP data like:

```json
{
  "success": true,
  "message": "1/1 vendor(s) uploaded to DMS",
  "results": [
    {
      "BP_LIFNR": "0001061303",
      "success": true,
      "message": "File(s) Uploaded Successfully",
      "sap": {
        "BP_LIFNR": "0001061303",
        "MSGTYP": "S",
        "MSGNR": "200",
        "ERDAT": "2026-05-18",
        "UZEIT": "18:57:22",
        "UNAME": "22000208",
        "MSG": "File(s) Uploaded Successfully"
      },
      "sapRows": [
        {
          "BP_LIFNR": "0001061303",
          "MSGTYP": "S",
          "MSGNR": "200",
          "MSG": "File(s) Uploaded Successfully"
        }
      ]
    }
  ]
}
```

## Important operational note

Because your middleware console currently shows only:

```text
Sharvi SAP middleware listening on :3002
SAP target: ...
CORS origins: *
```

and does **not** show the newer startup banner with middleware build/body limit, Windows is almost certainly running an older `server.js` or a different folder. The code change will help, but the server must be restarted from the updated middleware folder for `/sap/dms/upload` to exist.