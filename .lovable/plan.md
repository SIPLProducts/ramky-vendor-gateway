## Diagnosis

The SAP Sync popup is hitting the app backend function (`sap-master-fetch`) correctly. The failing part is that the backend function is trying to call the internal SAP URL directly:

`http://10.200.1.2:8000/vendor/bp/create?sap-client=300`

That internal `10.x.x.x` address is not reachable from Lovable Cloud, so it times out/aborts. Your `SAP Fields F4` config is saved with `connection_mode = proxy` and a middleware URL, but `sap-master-fetch` currently ignores proxy mode and always calls `base_url + endpoint_path` directly. That is why F4 values are not getting refreshed into the dropdown tables.

## Plan

1. **Update `sap-master-fetch` to honor proxy mode**
   - If the `SAP Fields F4` config uses `connection_mode = proxy`, call the configured middleware instead of calling `10.200.1.2` directly.
   - Use middleware endpoint `/sap/proxy` with the saved `proxy_secret`.
   - Pass the target SAP URL, HTTP method `GET`, headers, and no body.

2. **Keep direct mode as fallback**
   - If `connection_mode = direct`, continue using the existing direct SAP call logic.
   - Improve the error message so it says whether the failure came from direct SAP or middleware proxy.

3. **Parse middleware responses correctly**
   - Middleware `/sap/proxy` returns a wrapper like `{ ok, sapStatus, sapResponse }`.
   - If `sapResponse` contains the F4 JSON, unwrap it before mapping:
     - `VENDOR_ACC_GRP` → Vendor Account Group
     - `COMPANY_CODE` → Company Code
     - `PLANNING_GROUP` → Planning Group
     - `RECON_ACCOUNT` → Rec-Account
     - `PURCHASE_ORG` → Purchase Org
     - `CURRENCY` → Currency

4. **Ensure dropdown queries refresh after import**
   - Keep the popup opening behavior: opening SAP sync triggers `sap-master-fetch`.
   - After successful import, invalidate the per-master dropdown queries so values appear immediately.

5. **Optional middleware hardening if needed**
   - The existing middleware already has `/sap/proxy`, so no app-side UI change is needed.
   - If the middleware blocks the F4 URL because its host validation uses `SAP_BP_API_URL`, keep the same host (`10.200.1.2:8000`) and it should pass.

## Expected result

When opening the SAP Sync popup, the app will call `sap-master-fetch`, `sap-master-fetch` will call your configured middleware URL, the middleware will call the internal SAP GET API, and the returned F4 arrays will be saved into `sap_master_data` and shown in the popup dropdowns.