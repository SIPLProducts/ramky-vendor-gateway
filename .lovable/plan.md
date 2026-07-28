## Goal

In the SAP Sync Result dialog, all `ACC_RES` messages should be shown with consistent, attractive styling. Currently the duplicate row renders as a nice amber "Existing Vendor Details" table, but the second row (e.g. `"No Bank Key Available"`) falls through to a plain muted `bg-muted` block with just an Error badge — which looks broken next to the themed duplicate card (see screenshot).

## Change (visual only)

### `src/pages/SAPSync.tsx` — single SAP Sync Result dialog (lines ~1094–1105 fallback branch)

Replace the `bg-muted` fallback with a themed red "SAP Error" card that matches the visual language of the amber duplicate and green success cards:

- Outer container: `rounded-xl border border-red-300 bg-gradient-to-b from-red-50 to-white ring-1 ring-red-200/60 shadow-sm overflow-hidden`.
- Header bar: `bg-gradient-to-r from-red-100 to-rose-100 border-b border-red-300`, `XCircle` (or `AlertCircle`) icon in `text-red-700`, title `"SAP Error"` in `text-red-900 font-bold`, subtitle = the `LONGMSG` in smaller red-800 text.
- Body table (only rendered when there are extra fields): rows for `SAP Vendor Code`, `Business Partner`, `Reference No`, `MSG_TEXT` — same alternating `odd:bg-red-50/60 even:bg-white`, `text-red-900` labels, mono value column, matching the amber/green cards.
- If none of those fields exist (typical for `"No Bank Key Available"`), render just the header bar with the message — no empty table.

Success (non-duplicate) rows already use `SuccessVendorTable`; duplicate rows already use `DuplicateVendorTable`. Only the error fallback changes.

### Bulk SAP Sync Result dialog (lines ~1116+)

Apply the same red `SapErrorCard` component to the per-row error fallback so bulk results stay visually consistent with the single-sync dialog.

## Out of scope

- No changes to parsing (`isPanDuplicateResponse`), success/duplicate tables, edge functions, emails, or DB writes.
- No changes to the outer dialog header/footer.

## Verify

1. Trigger a SAP sync where `ACC_RES` contains a duplicate row + a `"No Bank Key Available"` row → dialog shows the amber Existing Vendor Details card followed by a red "SAP Error" card (not the plain muted block from the screenshot).
2. Trigger a pure success → still shows the green Vendor Details card only.
3. Trigger a bulk sync with mixed rows → each row renders in its correct themed card (green / amber / red).
