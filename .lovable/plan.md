## Goal
On SAP Sync, treat both `"PAN Number Duplicate"` AND `"PAN & GST combination is Duplicated"` errors as duplicates. Rename the existing duplicate-reject UI to "Duplicate & Close", introduce a new vendor status `sap_team_closed`, and notify the buyer by email. Existing "Reject & Send to Buyer" flow stays as is.

## Changes

### 1. DB migration — new enum value
Add `sap_team_closed` to `vendor_status` enum:

```sql
ALTER TYPE public.vendor_status ADD VALUE IF NOT EXISTS 'sap_team_closed';
```

(Existing `sap_team_rejected` is retained for backward compatibility / historical rows.)

### 2. `supabase/functions/sap-team-reject-vendor/index.ts`
- Change the status it writes from `sap_team_rejected` → `sap_team_closed`.
- Update `last_rejection_stage` to stay `SAP_TEAM`.
- Email headline / wording updated to "Vendor Closed — Duplicate in SAP" with body:
  > Vendor `<Ref No>` has been closed because a duplicate vendor already exists in SAP. No further action is required.
- Keep `autoTriggered` branch wording ("automatically closed due to PAN/GST duplicate in SAP").
- Email failure still does NOT abort the close (duplicate close is final); response keeps `email_sent` / `email_error`.
- Audit-log action strings updated: `sap_team_duplicate_close`, `buyer_notified_duplicate_close_email`, `buyer_duplicate_close_email_failed`.

### 3. `src/pages/SAPSync.tsx`
- **Tab rename:** "Duplicate Rejected Data" → "Duplicate & Closed".
- **Tab data source:** fetch BOTH `sap_team_closed` AND `sap_team_rejected` so existing historical rows still appear. Card badge label becomes "Duplicate & Closed".
- **Button rename:** "Duplicate Reject" → "Duplicate & Close". Icon stays.
- **Dialog rename:** Title "Duplicate & Close Vendor"; description "moved to the Duplicate & Closed tab"; remarks label "Duplicate & Close Remarks *" (already mandatory — kept).
- **Auto-detect regex** in `isPanDuplicateResponse` widened to also match `"PAN & GST combination is Duplicated"`:
  ```
  /pan\s*number\s*duplicat|duplicate\s*pan|pan\s*&\s*gst\s*combination\s*is\s*duplicat/i
  ```
  Applied to `LONGMSG`/`MSG` checks for both single sync (`handleConfirmSync`) and bulk sync (`handleMultipleSync`) paths. No other behavioural change to those handlers.
- Toast strings updated from "Duplicate Rejected Data" → "Duplicate & Closed".
- "Reject & Send to Buyer" button/dialog/handler — **unchanged**.

### 4. `src/hooks/useVendors.tsx` (if needed)
Confirm `useVendors([...])` accepts multi-status array (already does — used elsewhere). The Rejected tab query becomes `useVendors(['sap_team_closed', 'sap_team_rejected'])`.

## Out of scope
- No change to "Reject & Send to Buyer" flow, its status (`returned_to_buyer`), or its email template.
- No new email template files — HTML stays inlined in the edge function, matching existing pattern.
- No change to approval-stage rejection flows.
- No frontend changes outside `SAPSync.tsx` (and the hook call within it).
