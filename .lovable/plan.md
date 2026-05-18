## Fix Multiple SAP Sync dialog

**Issue 1 — Cannot scroll the dialog content.**
The dialog uses `ScrollArea` with `max-h-[60vh]`, but the parent `DialogContent` uses `overflow-hidden flex flex-col` and the inner Radix Viewport sometimes does not get a constrained height, breaking scroll. Replace the `ScrollArea` block with the same scroll pattern used in `SapFieldsDialog.tsx` (plain `div` with `flex-1 min-h-0 overflow-y-auto`), which is known to scroll reliably.

**Issue 2 — F4 dropdowns missing.**
Currently, `MultipleSapSyncDialog` renders SAP fields (Vendor Account Group, Company Code, Rec-Account, Planning Group, Purchase Org, Currency) as plain text inputs. Replace these with SAP F4 dropdowns (same component pattern as `SapFieldsDialog.SapF4SelectField`), so users can pick from live SAP F4 values just like the single-vendor sync dialog.

### Changes to `src/components/sap/MultipleSapSyncDialog.tsx`

1. Add F4 fetching on dialog open:
   - State: `f4Status` (idle/loading/success/error + message), `liveF4` (Record<string, any[]>).
   - On open: call `useRefreshSapMaster().mutateAsync()` to fetch live F4 values; populate `liveF4` from `res.sap_response`.
   - Show the same loading banner used in `SapFieldsDialog` ("Calling SAP Fields F4 API…") inside the header.
   - While loading, show the centered loader instead of the form (mirror SapFieldsDialog behavior).

2. Replace plain `TextField` with `SapF4SelectField` (extracted/shared) for:
   - Vendor Account Group → `vendor_account_group` / `liveF4.VENDOR_ACC_GRP`
   - Company Code → `company_code` / `liveF4.COMPANY_CODE`
   - Rec-Account → `recon_account` / `liveF4.RECON_ACCOUNT`
   - Planning Group → `planning_group` / `liveF4.PLANNING_GROUP`
   - Purchase Org → `purchase_org` / `liveF4.PURCHASE_ORG`
   - Currency → `currency` / `liveF4.CURRENCY`
   Keep TextField for Title, Tax Type, Sort Key, Calc Schema, Vendor Class.

3. Fix scroll:
   - Remove `ScrollArea` import/usage.
   - Replace the scrolling block with: `<div className="flex-1 min-h-0 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 220px)' }}>…</div>`.

4. Disable the "Sync Multiple to SAP" button while `f4Status.state === 'loading'`.

### Refactor

To avoid duplicating `SapF4SelectField` and the F4 field map, export them from `SapFieldsDialog.tsx` and import in `MultipleSapSyncDialog.tsx`. Export: `SapF4SelectField`, `F4_FIELD_MAP` (already an internal const). No other files affected.

### Out of scope

- No changes to the bulk sync edge function or payload builder.
- No behavior change to single-vendor `SapFieldsDialog`.
- No design system or color token changes.