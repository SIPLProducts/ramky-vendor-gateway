# SAP Sync Popup — F4 Dropdown Binding Plan

## What is already in place
The previous iteration already wired this end-to-end. On opening the SAP Sync popup:
1. `SapFieldsDialog` calls `useRefreshSapMaster()` → invokes the `sap-master-fetch` edge function.
2. The edge function reads the active `SAP Fields F4` config from `sap_api_configs`, calls the GET URL with stored credentials, parses the JSON, and upserts into `sap_master_data`.
3. Each dropdown is a `SapMasterCombobox` bound to a `master_type` and reads live rows via `useSapMasterData`.

## Field → JSON key → master_type mapping (verified)

| Popup Field | JSON Key | Code | Description | master_type |
|---|---|---|---|---|
| Vendor Account Group | `VENDOR_ACC_GRP` | `KTOKK` | `TXT30` | `vendor_account_group` |
| Company Code | `COMPANY_CODE` | `BUKRS` | `BUTXT` | `company_code` |
| Planning Group | `PLANNING_GROUP` | `GRUPP` | — | `planning_group` |
| Rec-Account | `RECON_ACCOUNT` | `SAKNR` | `TXT20` | `recon_account` |
| Purchase Org | `PURCHASE_ORG` | `EKORG` | `EKOTX` | `purchase_org` |
| Currency | `WAERS` | `WAERS` | `LTEXT` | `currency` |

All six are already in `MASTER_MAP` inside `supabase/functions/sap-master-fetch/index.ts`, and all six fields in `SapFieldsDialog.tsx` already use `<SapMasterCombobox>`.

## Small fix needed
**Recon Account** rows from SAP include `BUKRS` (Company Code), but the combobox currently shows the same `SAKNR` for every company code without distinguishing them. Plan:
- Show description as `"<SAKNR> — <TXT20> (BUKRS: <BUKRS>)"` in the combobox label so the same G/L code under different company codes is distinguishable.
- Optionally filter Recon Account dropdown by the currently selected `bukrs` value on the form (best UX, matches SAP behaviour).

## Validation steps after change
1. Open SAP Sync popup → Network tab should show one POST to `sap-master-fetch`.
2. Check edge function logs → confirm `summary` returned non-zero `upserted` for all 6 types.
3. Each of the 6 dropdowns shows refreshed values; manual entry still works as fallback.
4. If the "SAP Fields F4" config is unreachable (internal SAP), comboboxes silently fall back to cached `sap_master_data` rows — no popup error.

## Files to touch
- `src/components/sap/SapMasterCombobox.tsx` — accept optional `filter` prop and richer label rendering.
- `src/components/sap/SapFieldsDialog.tsx` — pass `filter={{ BUKRS: form.bukrs }}` to the Rec-Account combobox.
- `supabase/functions/sap-master-fetch/index.ts` — already stores raw item in `extra` column; no change needed.

No DB migration needed.
