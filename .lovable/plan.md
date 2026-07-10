## Fix: Existing Vendor Details missing in duplicate email (bulk sync)

### Root cause

For bulk SAP sync, the front-end iterates `result.results[]` (from `sync-vendors-to-sap-bulk`). Each item shape is:

```
{ vendorId, refNo, sapVendorCode, success, message /* LONGMSG */, raw /* the ACC_RES row incl. MSG_TEXT */ }
```

In `src/pages/SAPSync.tsx` (`handleMultipleSync`, line ~336):

```ts
const dup = isPanDuplicateResponse(r?.sapResponse || r);
```

`r.sapResponse` is undefined, so `isPanDuplicateResponse` receives `r` itself. Inside `isPanDuplicateResponse` it looks for `resp.ACC_RES` (array) to pull `MSG_TEXT`. `r` has no `ACC_RES`, so `msgText` stays `''` even though `r.raw.MSG_TEXT` holds the SAP text like `"4023080 - SHARDA GENPOWER PVT.LTD. - AAPCS1562H - 20AAPCS1562H1ZG"`.

Empty `existingVendorText` is then sent to `sap-team-reject-vendor`, which skips the "Existing Vendor Details" block — matching the screenshot the user shared.

Single-sync path is fine: `result.sapResponse` there is the full body `{ ACC_RES: [...], ... }`, so `MSG_TEXT` is extracted correctly.

Mixed bulk responses (some success, some duplicate, some bank/key errors) already behave correctly at the status level — only rows whose `LONGMSG` matches the duplicate regex are auto-closed; other failures are just shown in the result dialog. This fix keeps that unchanged.

### Fix (single file: `src/pages/SAPSync.tsx`)

Extend `isPanDuplicateResponse` so it also finds `MSG_TEXT` when the caller passes a single per-vendor bulk row. No other logic changes.

1. Inside the function, when building `msgText`, also inspect:
   - `resp.raw` (bulk per-vendor row)
   - `resp.MSG_TEXT` / `resp.MSGTEXT` / `resp.MSG_LONG_TEXT` (row passed directly)

   Prefer values found via `ACC_RES` first (single-sync path unchanged), fall back to the row-level fields.

2. Keep the regex/matching logic and all callers exactly as they are.

Resulting helper (conceptual):

```ts
const readMsgText = (o: any) =>
  String(o?.MSG_TEXT || o?.MSGTEXT || o?.MSG_LONG_TEXT || '').trim();

// after existing ACC_RES loop:
if (!msgText) msgText = readMsgText(resp?.raw) || readMsgText(resp);
```

### What stays untouched
- `sap-team-reject-vendor` edge function (already parses `"SAPCODE - NAME - PAN - GSTIN"` correctly).
- Single-vendor sync flow.
- Bulk sync mixed-response handling: success rows sync normally, non-duplicate failures continue to surface in the result dialog with their SAP message (bank key errors, missing fields, etc.), only true PAN/PAN+GST duplicates auto-move to Duplicate & Closed and trigger the email.
- All other email content, subject, styling.

### Verification
- Bulk sync 3 vendors: 1 success, 1 duplicate (`PAN & GST combination is Duplicated`), 1 bank-key error → success syncs, duplicate moves to Duplicate & Closed and the buyer email now includes the "Existing Vendor Details" table populated from `MSG_TEXT`, bank-key error stays visible in the result dialog without closing the vendor.
- Single-vendor duplicate sync: email still shows the "Existing Vendor Details" block (unchanged).
- `bunx tsgo --noEmit` clean.
