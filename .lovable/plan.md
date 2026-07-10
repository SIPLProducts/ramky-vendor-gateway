## Add Withholding Tax & Classification cards to "Multiple SAP Sync — Common Fields"

The single-vendor `SapFieldsDialog` already renders two sections that are missing from `MultipleSapSyncDialog`:
1. **Withholding Tax** (`WithholdingTaxSection`) — vendor-country-filtered tax type rows with codes/rec-types.
2. **Classification** — radio between `Vendor_Details` (MGV, CATV) and `Vendor_CFSTMT` (CASH, TIER) with F4 multi-selects.

Both must be added to the multiple-sync dialog so bulk syncs carry the same common header data.

### Changes (single file: `src/components/sap/MultipleSapSyncDialog.tsx`)

1. **State**
   - Add `classifyMode` state (`'details' | 'cfstmt'`, default `'details'`).
   - Reuse existing `form.classify` and `form.withholding` in `SapFieldOverrides`.

2. **Withholding Tax data fetch** (mirror `SapFieldsDialog`)
   - Add state: `wtAll`, `wtLoading`, `wtError`, `wtcAll`, `wtrAll`, `wtcLoading`, `wtcError`.
   - Add `fetchWtTypes()` invoking `sap-fetch-withholding-tax` (config `Fetch_Withholding_TaxType`).
   - Add `fetchWtCodesRectypes()` invoking `sap-fetch-wtx-code-rectype` (config `Fetch_Withholding_WTX_Code_REC_Type`).
   - Trigger both on dialog open (same effect that already fires F4 refresh).
   - Country filter: for bulk, no single vendor country — pass `undefined` (or the shared country if all vendors match); `wtFiltered = wtAll` when no country.

3. **Render sections** (after the existing Invoice Verification section, before footer)
   - `<Separator />` then reuse `WithholdingTaxSection` exported from `SapFieldsDialog.tsx` (export it if not already exported) with the same props.
   - `<Separator />` then a Classification block copied structurally from `SapFieldsDialog` (RadioGroup + two bordered panels with `SapF4MultiSelectField` for MGV/CATV and CASH/TIER). Reuse `handleClassifyModeChange` logic: switching modes clears the other group's arrays in state.

4. **Confirm handler**
   - Before calling `onConfirm(form)`, apply the same `finalClassify` derivation used in `SapFieldsDialog`:
     ```
     const finalClassify = classifyMode === 'details'
       ? { ...form.classify, CASH: [], TIER: [] }
       : { ...form.classify, MGV: [], CATV: [], LOCV: [], IDS: [] };
     onConfirm({ ...form, classify: finalClassify });
     ```
   - Withholding rows flow through untouched (already in `form.withholding`).

5. **Exports**
   - In `src/components/sap/SapFieldsDialog.tsx`, add `export` to `WithholdingTaxSection` (and any small helper it needs that isn't already exported) so `MultipleSapSyncDialog` can import it — no behavior change to single-sync dialog.

### Out of scope
- No changes to payload builder, edge functions, DB, or the single-vendor `SapFieldsDialog` UI (only an `export` keyword added).
- No changes to required-field validation set.

### Verification
- Open a bulk selection → click "Multiple SAP Sync" → confirm Withholding Tax and Classification cards render with the same UX as single sync.
- Submit and confirm the bulk sync payload includes `classify` and `withholding` per vendor.
- `bunx tsgo --noEmit` clean.
