
## Goal

Your SAP response structure (`VENDOR_ACC_GRP`, `COMPANY_CODE`, `PLANNING_GROUP`, `RECON_ACCOUNT`, `PURCHASE_ORG`, `CURRENCY`) is already mapped correctly in the edge function — the screenshot confirms 428 F4 options were refreshed and the dropdowns work (12 Purchase Orgs, 209 Currencies loaded).

The remaining issue is in `SapFieldsDialog.tsx`: **Rec-Account is being filtered by the selected Company Code (`BUKRS`)**, so users only see a subset. You want every dropdown to simply list **all** options returned by SAP for that master type — no matching/filtering between fields.

## Changes

### 1. `src/components/sap/SapFieldsDialog.tsx`
- Remove the `filter={{ BUKRS: form.bukrs }}` and `extraLabelFields={["BUKRS"]}` and `allowFilterFallback` props from the Rec-Account combobox so it shows all `recon_account` rows from SAP regardless of selected company code.
- (No other comboboxes currently use cross-field filters — Vendor Account Group, Company Code, Planning Group, Purchase Org, Currency already show all options.)

### 2. `src/components/sap/SapMasterCombobox.tsx`
- Mark the `filter` / `extraLabelFields` / `allowFilterFallback` props as no-ops (or remove them) since per your request we never want to match between fields. Simplest: keep the props for backward compatibility but always render all rows from `useSapMasterData(masterType)`.

### Out of scope
- No edge-function changes (`sap-master-fetch` already correctly parses your exact response structure).
- No DB / migration changes.
- No middleware changes.

## Result

Every SAP field in the "SAP Field Confirmation" dialog will list the full set of values returned by SAP for that key (e.g., all `RECON_ACCOUNT` entries, all `CURRENCY` entries) — exactly mirroring your SAP response, with no inter-field filtering.
