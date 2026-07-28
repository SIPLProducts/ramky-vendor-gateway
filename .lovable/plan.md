## Root cause

The duplicate response is now correctly reaching the client, but on the failure path in `src/pages/SAPSync.tsx › handleConfirmSync` we throw the SAP response away before parsing it.

`useSAPSync` (`src/hooks/useVendors.tsx`, ~line 600) turns `success: false` into a thrown Error and attaches the SAP data as:

```
err.sapResponse = sapResult.sapResponse   // raw SAP array [{ ACC_RES, TOT_RES }]
err.sapResult   = sapResult               // full envelope incl. ACC_RES
```

But the `catch` block in `handleConfirmSync` reads `error?.ACC_RES` (which doesn't exist) and falls back to a synthetic single row:

```
[{ MSGTYP:'E', LONGMSG: msg, BP_LIFNR:'', BPNAME: vendor.legal_name }]
```

That synthetic row has no `MSG_TEXT`. `isPanDuplicateResponse` matches the regex on `LONGMSG` ("PAN & GST combination is Duplicated") so `matched=true`, but `msgText` stays `""`. `autoRejectAsDuplicate` is then called with `existingVendorText=''`, so `sap-team-reject-vendor` stores `sap_duplicate_details: null` → the email has no "Existing Vendor Details" block and the "Duplicate & Closed" card has nothing to render.

The success path in the same handler and the bulk `handleMultipleSync` path already pass the real SAP response into `isPanDuplicateResponse`, so this only regressed for the single-vendor duplicate flow that comes back via the thrown-error branch (which is the current SAP behaviour — `success:false` → thrown).

## Fix (single file, single function)

`src/pages/SAPSync.tsx` — in the `catch (error)` branch of `handleConfirmSync`:

1. Build `failResp` from what the hook actually attaches, in this priority:
   - `error.sapResult` if present (full envelope with `ACC_RES` + `sapResponse`)
   - else `{ success:false, message: msg, sapResponse: error.sapResponse }` when `sapResponse` exists
   - else the current synthetic fallback (unchanged, for true network errors)
2. Call `isPanDuplicateResponse` on that `failResp` — the existing parser already walks `sapResponse` / `ACC_RES` / `TOT_RES` and pulls `MSG_TEXT` from the row whose `LONGMSG` matches the duplicate regex.
3. Keep `setSapSyncResult(failResp)` so the result dialog also shows the real SAP rows (not just the synthesized one-line error).

No changes to:
- `isPanDuplicateResponse` (already correct for the shapes we now feed it)
- `sap-team-reject-vendor` (already parses 2/3/4-part `MSG_TEXT` and renders "Existing Vendor Details" before the Reason row in the email)
- The "Duplicate & Closed" card in `SAPSync.tsx` (already renders the table above the Remarks block)
- Schema / migrations / RLS

## Verify

1. Trigger a single-vendor SAP sync against the known duplicate PAN (`RSJ HOLDINGS` / `AACFU0481F`).
2. Query `vendors.sap_duplicate_details` for that vendor — expect `"1017575 - Rsj Holdings - AACFU0481F - 29AACFU0481F1Z7"`.
3. Buyer email: "Existing Vendor Details" table (SAP Vendor Code, Vendor Name, PAN, GSTIN) appears above the Reason row.
4. SAP Sync → Duplicate & Closed card: same 4-row table appears above the "Duplicate & Close Remarks" block.
5. Vendors already closed with `sap_duplicate_details = NULL` stay as-is (no backfill requested).