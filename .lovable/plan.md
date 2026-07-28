## Goal

Simplify the SAP Sync Result popup (single + bulk) so duplicate and error rows render as plain text lines instead of table grids, matching:

```text
PAN & GST combination is Duplicated  error
4019846 - VEDA CONSTRUCTIONS - AAQFV6687C - 29AAQFV6687C1ZE

No Bank Key Available  error
```

Scope: **only** the SAP Sync result popup on `/sap/sync` (single sync dialog + bulk sync dialog). No other dialogs, emails, edge functions, or logic change.

## Change

### `src/pages/SAPSync.tsx`

1. Remove `DuplicateVendorTable`, `SapErrorCard`, and the unused `parseDupMsgText` helper.
2. Add a single `SapErrorMessage` component:
   - Amber theme when `isDuplicate` is true, red theme otherwise.
   - Renders `LONGMSG` as the main line + a small `error` badge, and `MSG_TEXT` as a second mono line beneath it.
   - No inner table, no split fields (no SAP Code / Business Partner / Reference No rows).
3. In the **single SAP Sync Result** dialog (around lines 1100–1136), replace both the `DuplicateVendorTable` and `SapErrorCard` branches with `SapErrorMessage`, passing `isDuplicate={dup.matched}`, `message={longMsg || dup.message}`, and `msgText={dup.msgText || r.MSG_TEXT}`.
4. In the **bulk SAP Sync Result** dialog (around lines 1160–1182), do the same replacement for non-success rows.
5. Keep `SuccessVendorTable` unchanged — successful rows continue to render as the green details table.

## Out of scope

- Success card, DMS result dialog, email templates, auto-reject logic, SAP response parsing, edge functions.

## Verify

1. SAP sync returning a duplicate row + a "No Bank Key Available" row → popup shows two plain-text cards (amber, then red) exactly like the requested format.
2. Pure SAP error → red plain-text card with the message and any `MSG_TEXT`.
3. Successful sync → green Vendor Details table unchanged.
4. Bulk sync with mixed rows → each row renders as either the green success table or the correct plain-text error/duplicate card.