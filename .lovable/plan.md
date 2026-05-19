## Goal

Make all 6 SAP F4 dropdowns load dynamically from SAP — no hardcoded values. The frontend wiring is already done; the only blocker is one wrong SAP JSON key in the edge function and a one-time SAP sync.

## Root cause

Screenshot 2 confirms the actual SAP response keys are:
`MAT_GRP_VENDOR`, `CAT_VENDOR`, `LOCATION_VENDOR`, **`IDENTIFICATION_SOURCE`**, `COUNTRY`, `REGION`.

The edge function `supabase/functions/sap-master-fetch/index.ts` currently looks for `ID_SOURCE_VENDOR` (line 31). Because that key never matches, the `identification_source` master table stays empty → "No SAP values" shown in Vendor Identification Source dropdown.

The other 5 keys are already mapped correctly. The dropdowns themselves (`OrganizationStep.tsx`, `IntlClassificationStep.tsx`, `IntlCompanyDetailsStep.tsx`) already read from `useSapMasterData(...)` with the right master_types and the region dropdown already filters by selected country via `extra.LAND1`.

## Changes

### 1. `supabase/functions/sap-master-fetch/index.ts`
- Rename the `ID_SOURCE_VENDOR` entry in `MASTER_MAP` to `IDENTIFICATION_SOURCE` (keep `type: "identification_source"`, `code: "ATWRT"`, `desc: "ATWTB"`).
- No other logic changes. Country, Region (composite `LAND1_BLAND` code with full row in `extra`), Material Group, Vendor Category, Vendor Location mappings stay as-is.

### 2. Deploy + sync
- Redeploy the edge function.
- User opens **SAP API Settings → Master Data (F4)** and clicks the sync/refresh action once. This populates `sap_master_data` for all 6 master_types from the live SAP response.

## What the user will see after sync

- **Domestic → Organization Profile → Classification**: Material Group, Vendor Category, Vendor Location, Vendor Identification Source all populated from SAP.
- **International → Company Details**: Country dropdown from `COUNTRY`; Region dropdown auto-filters to only regions whose `LAND1` matches the selected country (already implemented).
- **International → Classification**: same 4 SAP-driven dropdowns as domestic.
- **International → Bank Details**: Bank Country dropdown from `COUNTRY` (already implemented in previous turn).

## Out of scope

- No hardcoded fallback lists anywhere.
- No DB schema changes (uses existing `sap_master_data` table).
- No changes to any other frontend file — wiring is already correct.
