## Goal
Apply F4 (searchable dropdown) value-help to the remaining SAP master fields in the SAP Sync popup, and auto-refresh values from SAP when the popup opens.

## Scope (frontend only, no DB / edge-fn changes)

The edge function `sap-master-fetch` and the `sap_master_data` table already support all 6 master types (`vendor_account_group`, `company_code`, `planning_group`, `recon_account`, `purchase_org`, `currency`). Only the dialog wiring is missing.

### 1. `src/components/sap/SapFieldsDialog.tsx` — swap inputs to combobox

Replace the existing `<TextField>` instances with `<SapMasterCombobox>` for these fields (form key → master_type):

- `bukrs` (Company Code) → `company_code`
- `akont` (Rec-Account) → `recon_account`
- `fdgrv` (Planning Group) → `planning_group`
- `vkorg` (Purchase Org) → `purchase_org`
- `waers` (Currency) → `currency`

`partn_grp` already uses the combobox — leave as-is. `zuawa`, `kalsk`, `ven_class`, and the Classification fields stay as plain text inputs (no master JSON for them).

### 2. Auto-refresh on popup open

Inside the existing `useEffect` that runs when `open` becomes true, also fire `supabase.functions.invoke('sap-master-fetch', { body: { master_types: ['vendor_account_group','company_code','planning_group','recon_account','purchase_org','currency'] } })` once per open, then invalidate the `["sap_master_data"]` query so all comboboxes show the freshest values. Failure is silent (toast not needed — manual entry still works, the dropdown falls back to cached rows).

To keep this clean, add a small `useRefreshSapMaster()` call (already exported from `src/hooks/useSapMasterData.tsx`) and trigger it from the dialog open effect — no new hooks needed.

### 3. No other changes
- No DB migration.
- No edge function change.
- `SapMasterDataTab` (Settings page) is unchanged; its manual Refresh button keeps working.
- Combobox keeps allowing free-typed custom values, so users are never blocked if SAP is unreachable.

## Acceptance
- Opening the SAP Sync dialog triggers one background SAP refresh.
- Company Code, Rec-Account, Planning Group, Purchase Org, Currency, and Vendor Account Group all show searchable dropdowns sourced from `sap_master_data`.
- Typing a custom value still works for any of them.
