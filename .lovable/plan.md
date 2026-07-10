## Plan: Fix SAP response correlation, duplicate email details, and idnum ref no

### Issue
Bulk SAP responses now identify each row using `REFER_NUM`, not `idnum`:

- Duplicate/error rows may appear in `ACC_RES` with `REFER_NUM` and `MSG_TEXT`.
- Detailed messages may also appear in `TOT_RES` with `REFER_NUM` and `LONG_MSG`.
- Current bulk sync mainly matches rows by `idnum`, then falls back to array position. That can attach a duplicate/bank-key/success result to the wrong vendor when mixed responses come back.
- The client payload builder still uses an 8-character vendor ID fallback for `idnum` in one path, while SAP expects the vendor reference number.

### Fix
1. **Always send vendor reference number as `idnum`**
   - Update client-side SAP payload generation so `row.idnum` uses `vendor.reference_number` first, falling back to vendor ID only if missing.
   - Keep server-side single and bulk sync final-normalization as the source of truth, also forcing `idnum = reference_number` before sending to SAP.

2. **Support new SAP response shape in bulk sync**
   - In `sync-vendors-to-sap-bulk`, parse both `ACC_RES` and `TOT_RES` from SAP responses.
   - Match each vendor response by `REFER_NUM` first, then `idnum`, then existing positional fallback.
   - Merge the matching `ACC_RES` and `TOT_RES` row details so each `results[]` item carries the correct raw SAP row for that specific reference number.

3. **Preserve mixed bulk behavior**
   - Success rows continue to update the vendor and move to DMS pending.
   - Duplicate rows only move that matching vendor to Duplicate & Closed and send the buyer email.
   - Bank key or other non-duplicate errors stay visible in the Multiple SAP Sync result dialog and do not close the vendor.

4. **Populate duplicate email details from both old and new fields**
   - Extend duplicate detection to read existing vendor details from:
     - `MSG_TEXT`
     - `MSGTEXT`
     - `MSG_LONG_TEXT`
     - `LONG_MSG`
     - `raw.MSG_TEXT`
     - `raw.LONG_MSG`
     - `totRaw.LONG_MSG`
   - This preserves the existing email parser and only improves the input text passed to it.

5. **Improve Multiple SAP Sync result display**
   - Show reference number from `REFER_NUM`, `idnum`, or the mapped result `refNo`.
   - Show the correct message from `LONGMSG`, `LONG_MSG`, `MSG_TEXT`, or `MSG`.
   - Prefer `results[]` for display when available so each card corresponds to one selected vendor and its correct SAP outcome.

### Files to change
- `src/lib/sapPayloadBuilder.ts`
- `supabase/functions/sync-vendors-to-sap-bulk/index.ts`
- `src/pages/SAPSync.tsx`

### Validation
- Run TypeScript check.
- Verify a mixed bulk response with one success, one duplicate using `REFER_NUM`, and one bank key error maps each message to the correct vendor.
- Confirm duplicate email includes:
  - SAP Vendor Code
  - Vendor Name
  - PAN Number
  - GSTIN