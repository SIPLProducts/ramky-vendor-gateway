## 1. Legal Name fallback — make blank values actually fall through

Today `getSapName1` uses plain `||`, so a `trade_name` of `" "`, `""`, `"-"`, `"—"`, or `"N/A"` is treated as a real value and the Legal Name fallback never fires. That's why some rows still render blank or as "Unnamed Vendor".

**`src/lib/sapPayloadBuilder.ts` — `getSapName1`**
- Add a tiny `clean(x)` helper: returns `""` for null/undefined, whitespace-only strings, and placeholder tokens `-`, `—`, `N/A`, `NA`.
- GST = Yes branch: `clean(trade_name) || clean(legal_name) || clean(account_holder_name)`.
- GST = No  branch: `clean(account_holder_name) || clean(legal_name) || clean(trade_name)`.

**`src/hooks/useRealtimeUpdates.tsx` — `pickVendorName`**
- Same blank-aware fallback so realtime updates don't overwrite a good name with whitespace.

**`src/pages/AuditLogs.tsx`**
- Replace inline `gstin ? trade_name : legal_name` with the same blank-aware fallback (small local helper).

All other screens (All Vendors, SAP Sync, Finance Review, Purchase Approval, Vendor Status, Review Dialog, Submission Preview) already go through `getSapName1`, so fixing the helper propagates everywhere.

---

## 2. Always display `VENDOR` (e.g. `1017540`), never `BP_LIFNR` (e.g. `1061357`)

No schema change. Strictly prefer `VENDOR` end-to-end so it's stored in `vendors.sap_vendor_code` and shown in every table, dialog, toast, SweetAlert, email, and audit log.

**Backend (edge functions) — write VENDOR only**
- `supabase/functions/sync-vendor-to-sap/index.ts`
  - Replace every `successRow.VENDOR || successRow.BP_LIFNR` and `r.VENDOR || r.BP_LIFNR` with just `successRow.VENDOR` (fallback to BP_LIFNR only when VENDOR is truly empty).
  - Normalize ACC_RES rows so `BP_LIFNR` is set to the VENDOR value before returning to the client (so any downstream consumer that still reads `BP_LIFNR` gets the VENDOR number). Keep the original `BP_LIFNR` available under a new key `BP_LIFNR_ORIG` so DMS upload still has the BP id when it actually needs it.
  - Persist `sap_vendor_code = VENDOR`; the email subject/body uses VENDOR.
- `supabase/functions/sync-vendors-to-sap-bulk/index.ts`
  - Same change in the per-row loop: `sapVendorCode = match.VENDOR ?? match.BP_LIFNR`, write VENDOR into `sap_vendor_code`, audit log details show VENDOR, and the normalized `ACC_RES` returned to the client carries `VENDOR` (and stamps `BP_LIFNR` with the VENDOR value for legacy UI consumers, preserving the original as `BP_LIFNR_ORIG`).
- `supabase/functions/sync-vendor-to-dms/index.ts` + `supabase/functions/prepare-dms-payload/index.ts`
  - DMS still needs the BP_LIFNR identifier in its outbound payload. Read `vendors.sap_vendor_code` (now = VENDOR) and use it as-is — SAP DMS accepts the VENDOR number in the `BP_LIFNR` field per the new API behavior. No display change here; this only affects what we send to SAP.

**Frontend — use VENDOR in every visible spot**
- `src/pages/SAPSync.tsx`
  - Sync-result panel / success toast / SweetAlert row: change `{r.VENDOR || r.BP_LIFNR}` → `{r.VENDOR ?? r.BP_LIFNR}` (VENDOR strictly first) and update the label to "SAP Vendor Code".
  - DMS tab and Synced tab columns already read `v.sap_vendor_code` (now VENDOR) — no change.
- `src/pages/VendorList.tsx`
  - Table cell, details panel, CSV export already read `vendor.sap_vendor_code` (now VENDOR) — no change.
- `src/components/vendor/VendorReviewDialog.tsx`, `VendorSubmissionPreviewDialog.tsx`
  - Any "SAP Vendor Code" / `BP_LIFNR` field reads `vendor.sap_vendor_code` — already VENDOR after the backend change.
- `src/hooks/useVendors.tsx` success toast (`SAP Vendor Code: …`)
  - Already reads `sapVendorCode` from the edge response, which now equals VENDOR.

**Legacy data**
Rows already synced before this change have BP_LIFNR stored in `sap_vendor_code` — there's no way to recover the matching VENDOR id, so those rows will keep showing the old number until they are re-synced. Every new sync from now on will store and display VENDOR.

---

## Verification

- GST = Yes vendor with `trade_name = " "` / `"-"` → All Vendors, SAP Sync, Finance Review, Purchase Approval, Audit Logs, Review Dialog all show the Legal Name.
- GST = No vendor with empty Account Holder Name → same screens show Legal Name.
- Sync a new vendor where SAP returns `{ VENDOR: "1017540", BP_LIFNR: "1061357" }`:
  - All Vendors and SAP Sync show `1017540` in the SAP Vendor Code column.
  - Sync-success SweetAlert / toast shows `SAP Vendor Code: 1017540`.
  - Buyer notification email shows `1017540`.
  - Audit log details show `sap_vendor_code: 1017540`.
  - DMS upload still succeeds (payload carries `1017540` as the identifier, which the new SAP API accepts).
