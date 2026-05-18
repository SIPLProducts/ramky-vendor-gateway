## Two-part change: Phone validation + SAP Multiple Sync & DMS Sync

### Point 1 — Restrict every phone/contact field to 10 digits, numeric only

Most vendor-registration steps (`ContactStep`, `AddressStep`) already enforce 10-digit numeric phones via a `numericField`/`phoneField` wrapper. The places still accepting alphanumeric input:

1. **`src/pages/AdminInvitations.tsx`** (lines 481–490, "Create Vendor Invitation" dialog — the screenshot)
   - Change `<Input type="tel">` to use `inputMode="numeric"`, `pattern="\d{10}"`, `maxLength={10}`, and an `onChange` that strips non-digits via `digitsOnly(value, 10)`.
   - Block submission when `phoneNumber.length !== 10` — disable the **Create Invitation** button and show an inline error "Enter a 10-digit mobile number".

2. **`src/components/vendor/steps/ComplianceStep.tsx`** line 603 (`msmeMobile`)
   - Replace the bare `register('msmeMobile')` with the same numeric/10-digit wrapper used elsewhere in the file (mirror `panNumber` / phone handling).

3. **`src/components/vendor/DynamicStep.tsx`** line 120 (`case 'phone'`)
   - Add `inputMode="numeric"`, `maxLength={10}`, and an `onChange` that strips non-digits before calling the field's onChange, so every dynamic phone field built by the form-builder is also restricted.

4. **Re-use** the existing `digitsOnly(value, max)` helper in `src/lib/utils.ts` — no new utility needed.

No DB / edge-function changes for Point 1.

---

### Point 2 — Multi-select SAP Sync + DMS Sync tab

**A. DB migration (one migration)**
- Add two new values to the `vendor_status` enum: `'dms_sync_pending'` and `'dms_synced'`.
- Add a nullable column `vendors.dms_synced_at timestamptz`.
- Add `vendors.sap_reference_no text` (stores the 8-char `idnum` sent to SAP) so DMS Sync can show **Ref Number** even after re-sync.
- No RLS change (existing vendor policies cover the new columns).

**B. `src/pages/SAPSync.tsx`** — add checkbox selection + Multiple Sync flow + DMS Sync tab

1. Top of page becomes a **Tabs** control with two tabs:
   - **Ready for SAP Sync** (current list, vendors with status `pending_sap_sync` / `purchase_approved`)
   - **DMS Sync** (vendors with status `dms_sync_pending`)
   Beside the existing "Ready for Sync" stats card, add a second **DMS Sync** stats card showing the DMS-pending count.

2. In the **Ready for SAP Sync** tab:
   - Add a `Checkbox` on each vendor row + a header row with a "Select all visible" checkbox.
   - Track `selectedVendorIds: Set<string>` in state.
   - When `selectedVendorIds.size > 1`:
     - Disable every per-row **Prepare & Sync** button (tooltip: "Uncheck other vendors to sync individually").
     - Show a new **Multiple Sync** button in the toolbar above the list (next to the search box) — `variant="default"` with `Server` icon and count badge ("Multiple Sync (3)").
   - When `selectedVendorIds.size <= 1`: hide **Multiple Sync**, per-row buttons behave as today.

3. **Multiple Sync popup** — new component `src/components/sap/MultipleSapSyncDialog.tsx`:
   - Reuses `SapFieldsDialog`'s field layout but only renders the **common/header-level** sections:
     - Vendor Header (partn_cat / partn_grp / title / taxtype)
     - Company Code Data (bukrs / akont / zuawa / cdi / fdgrv)
     - Purchase Data (vkorg / waers / kalsk / ven_class)
     - GR-Based Invoice Verification (webre)
     - Service-Based Invoice Verification (lebre)
     - Check Duplicate (existing flag)
   - Hides vendor-specific (`msme`, `idtype`, `idnum`, `classify`) — those are derived per vendor.
   - Footer button: **Sync Multiple to SAP** (instead of "Confirm & Sync").

4. **Submit handler** (`handleMultipleSync`):
   - For each selected vendor, build payload via `buildSapPayload(vendorId, commonOverrides)` (already per-vendor aware — sets `idnum` from vendor reference, MSME idnum2 from vendor MSME). Concatenate the resulting payload rows into one array.
   - Call new edge function `sync-vendors-to-sap-bulk` (see C) with `{ vendorIds, overrides, sapPayload }`.
   - Show **bulk result popup** that lists every `ACC_RES` row: `MSGTYP` badge, `BP_LIFNR`, `LONGMSG`, and the matching vendor name.
   - On any success row, update vendor: `status='dms_sync_pending'`, `sap_vendor_code=BP_LIFNR`, `sap_synced_at=now()`, `sap_reference_no=idnum used`. Failure rows stay in Ready list with a toast.

5. **DMS Sync tab** layout — table with columns:
   - Vendor Name
   - **Ref Number** (`sap_reference_no` / first 8 chars of `vendor.id`)
   - **SAP Vendor Code** (`sap_vendor_code` / `BP_LIFNR`)
   - **Sync Status** (badge: Pending DMS / DMS Synced)
   - **Message Response** (last SAP `LONGMSG` from `audit_logs`)
   - Per-row **Sync to DMS** button + a **Bulk DMS Sync** button when multi-selected.
   - On click, call new edge function `sync-vendor-to-dms` with `{ vendorIds, documents: [...] }` (payload built client-side using `vendor_documents` rows — mirrors the existing document-array sample). On success, set status `dms_synced`, `dms_synced_at=now()`.

**C. Edge functions**

1. **New `supabase/functions/sync-vendors-to-sap-bulk/index.ts`**
   - Accepts `{ vendorIds: string[], overrides, sapPayload }`.
   - Forwards `sapPayload` (already an array of vendor rows) to the configured SAP create endpoint exactly as the single-vendor function does.
   - Returns `{ success, ACC_RES: [...], rawResponse }` so the client can match `BP_LIFNR` back to vendors using the `idnum` correlation.

2. **New `supabase/functions/sync-vendor-to-dms/index.ts`**
   - Accepts `{ vendorIds, documents }`.
   - POSTs the document array to the configured DMS endpoint (read from `sap_api_configs` where `purpose='dms_upload'` — fallback to a tenant secret).
   - Returns per-vendor success/failure so the UI can flip status to `dms_synced`.
   - Both functions registered in `supabase/config.toml` with `verify_jwt = true` (default).

**D. Client wiring**

- Add `useMultipleSAPSync()` and `useDMSSync()` hooks in `src/hooks/useVendors.tsx` mirroring `useSAPSync`.
- Update `useVendors(['pending_sap_sync','purchase_approved'])` call in `SAPSync.tsx` to also fetch `['dms_sync_pending','dms_synced']` for the DMS tab (single query, filter client-side).

### Out of scope

- Changing the existing single-vendor **Prepare & Sync** flow (still works for 0–1 selection).
- New SAP master-data fields beyond what `SapFieldsDialog` already exposes.
- Touching approval workflow stages or notification emails.
- Document array schema for DMS — assume the existing `vendor_documents` records (storage path + type) are the payload contract; the new edge function just forwards them.

### Files touched

- `src/pages/AdminInvitations.tsx`
- `src/components/vendor/steps/ComplianceStep.tsx`
- `src/components/vendor/DynamicStep.tsx`
- `src/pages/SAPSync.tsx`
- `src/components/sap/MultipleSapSyncDialog.tsx` *(new)*
- `src/hooks/useVendors.tsx`
- `supabase/functions/sync-vendors-to-sap-bulk/index.ts` *(new)*
- `supabase/functions/sync-vendor-to-dms/index.ts` *(new)*
- `supabase/config.toml` (register two new functions)
- One DB migration (enum values + 2 columns)
