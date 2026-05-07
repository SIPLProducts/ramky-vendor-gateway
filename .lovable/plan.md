# SAP Sync Screen Enhancements

## Point 1 — Dynamic approval badge

On the SAP Sync list (`src/pages/SAPSync.tsx`), the green badge currently reads "Purchase Approved" for every row. Replace it with a label derived from the vendor's MSME status:

- If vendor is **MSME (Yes)** → final approver was CEO Office → show badge **"CEO Office Approved"**
- If vendor is **Not MSME (No)** → final approver was Finance 2 → show badge **"Finance 2 Approved"**

MSME detection: use `msme_number` (non-empty) or `msme_verification_status === 'passed'` (same logic already used in `buildPayload` and Finance2 routing).

## Point 2 — SAP fields pre-sync popup

Currently clicking **Sync** immediately calls the edge function. Change the flow:

1. Clicking the action button (rename to **"Prepare & Sync"**) opens a new modal: **"SAP Field Confirmation"**.
2. Modal contains a form pre-populated with the SAP-payload fields from the user's JSON spec, grouped into 3 sections matching the Excel screenshot:

   **Vendor Header**
   - Vendor (Person/Organization/Group) — `partn_cat` — Select [1=Person, 2=Organization, 3=Group] (default 2)
   - Vendor Account Group — `partn_grp` — default `ZDOM`
   - Title — `title` — Select [0001 Mr., 0002 Mrs., 0003 Ms.]
   - GST Category — `taxtype` — default `IN3`
   - MSME (Minority Indicator) — `msme` — Select [MIC, blank]; auto-set based on MSME flag, editable
   - MSME Reg Type — `idtype` — default `ZMSMEN` when MSME
   - MSME ID Number — `idnum` — pulled from `msme_number`

   **Company Code Data**
   - Company Code — `bukrs` — default `1000`
   - Rec-Account — `akont` — default `155000005`
   - Sort Key — `zuawa` — default `014`
   - Check Duplicate Invoice — `cdi` — Checkbox (X / blank), default X
   - Planning group — `fdgrv` — default `A1`

   **Purchase Data**
   - Purchase Org — `vkorg` — default `1000`
   - Currency — `waers` — default `INR`
   - Group for Calculation Schema (Supplier) — `kalsk` — default `L1`
   - Indicator: GR-Based Invoice Verification — `webre` — Checkbox, default X
   - Indicator: Service-Based Invoice Verification — `lebre` — Checkbox, default X
   - Vendor Class — `ven_class` — text, default blank

   **Classification (optional, collapsible)**
   - Material Group (`MAT_GRP_VENDOR.MGV`) — text e.g. CEMENT
   - Category (`CAT_VENDOR.CATV`) — text e.g. TRADER
   - Location (`LOCATION_VENDOR.LOCV`) — pre-filled from `registered_state`
   - Identification Source (`IDENTIFICATION_SOURCE.IDS`) — text

3. Modal footer: **Cancel** + **Sync to SAP** (primary). Only the second click triggers the actual sync.

## Wiring changes

### `src/pages/SAPSync.tsx`
- Add `showSapFieldsDialog` state and `sapFieldsForm` state.
- Replace direct `handleSyncToSAP` call with `openSapFieldsDialog(vendor)` that pre-populates defaults (using vendor MSME, state, etc.).
- Rename button to **"Prepare & Sync"**.
- Replace hardcoded `"Purchase Approved"` Badge with dynamic label helper `getApprovalLabel(vendor)`.
- New modal renders the grouped form; on submit calls `handleSyncToSAP(vendor, sapFieldsForm)`.

### `src/hooks/useVendors.tsx` (`useSAPSync`)
- Extend the mutation input to accept an optional `overrides` object and forward it in the `supabase.functions.invoke('sync-vendor-to-sap', { body: { vendorId, overrides } })` call.

### `supabase/functions/sync-vendor-to-sap/index.ts`
- Accept `overrides` from the request body.
- After `buildPayload(vendor)`, merge the allowed override keys (`partn_cat, partn_grp, title, taxtype, msme, idtype, idnum, bukrs, akont, zuawa, cdi, fdgrv, vkorg, waers, kalsk, webre, lebre, ven_class`) on top of the row.
- If overrides include `classify`, attach a `CLASSIFY` block:
  ```
  CLASSIFY: {
    MAT_GRP_VENDOR: [{ MGV: ... }],
    CAT_VENDOR: [{ CATV: ... }],
    LOCATION_VENDOR: [{ LOCV: ... }],
    IDENTIFICATION_SOURCE: [{ IDS: ... }],
  }
  ```
  (omit empty arrays).
- Also build the `vendors:[{...}]` mirror sub-array per the spec by copying the vendor-level fields the SAP payload requires, so the final shape matches the customer's JSON example. `customers` stays as `[{...empty...}]`.
- Existing `UPLOAD` array logic is unchanged.

## Out of scope
- No DB schema changes.
- No new tables for SAP defaults — defaults are constants in the dialog component (can be migrated to `sap_api_configs` later if needed).
- Approval routing logic itself is untouched (that was fixed in earlier turns).
