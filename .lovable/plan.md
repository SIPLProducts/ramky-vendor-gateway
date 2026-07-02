## Goals

1. Apply a single, consistent vendor-name fallback everywhere: **Trade Name → Legal Name → PAN/Account Holder Name**.
2. When a rejected vendor is routed back to the Buyer (`returned_to_buyer`) or Vendor (`returned_to_vendor`), the previously saved data must remain intact and pre-fill the form — only a brand-new application starts blank.

---

## Part 1 — Vendor name fallback

Today the fallback is inconsistent: some screens use `legal_name || trade_name`, others `trade_name || legal_name`, and `getSapName1` flips the order based on whether GSTIN is present. We will standardize on one helper.

### 1a. Central helper
Add `pickVendorDisplayName(vendor)` in `src/lib/sapPayloadBuilder.ts` (co-located with `getSapName1`, so existing imports keep working):

```text
trade_name → legal_name → account_holder_name  (PAN/bank holder name) → ''
```

Placeholder tokens (`-`, `—`, `N/A`, `NA`, `none`, `null`) are treated as empty using the existing `cleanName` logic. Export it from `src/lib/sapPayloadBuilder.ts`.

Also update `getSapName1` to use the same precedence unconditionally (drop the GSTIN branch), so SAP `NAME1` and every UI label match.

### 1b. Call-site replacements
Replace the ad-hoc `vendor.legal_name || vendor.trade_name` / `trade_name || legal_name` patterns with `pickVendorDisplayName(vendor)`:

- `src/pages/SAPSync.tsx` — all `getSapName1(v) || v.legal_name || …` chains and the search filter (also match trade & holder name).
- `src/components/sap/MultipleSapSyncDialog.tsx`
- `src/components/sap/ApprovalCommentsDialog.tsx` (caller passes name already — update the caller in SAPSync).
- `src/components/vendor/VendorSubmissionPreviewDialog.tsx` — dialog title label.
- `src/lib/reports/loadVendorReport.ts` — `vendor_name: v.legal_name || v.trade_name || '—'` → `pickVendorDisplayName(v) || '—'` (add `account_holder_name` to the select list).
- `src/hooks/useRealtimeUpdates.tsx` — replace the local `pickVendorName` with the shared helper.
- `supabase/functions/list-pending-approvals-by-stage/index.ts` — replace both `vendorName:` expressions and add `account_holder_name` to both `.select(...)` lists. This drives all approval-screen tables (Buyer / SCM CO / SCM Head / Finance 1 / Finance 2 / CEO).
- `supabase/functions/sap-team-return-to-buyer/index.ts` and `supabase/functions/sap-team-reject-vendor/index.ts` — the local `vendorLabel` helpers currently do `account_holder_name || trade_name || legal_name`; reorder to Trade → Legal → Holder.
- `supabase/functions/sync-vendor-to-sap/index.ts` — the `NAME1` default at line 184 uses `legal_name || account_holder_name || trade_name`; reorder to Trade → Legal → Holder to match `getSapName1`.

No DB migration is needed — `account_holder_name` already exists on `vendors`.

---

## Part 2 — Preserve data on rejection routing

Root cause: the edit-form entry points and helpers gate on status lists that omit `returned_to_buyer`, so when a Buyer opens a vendor that Finance sent back, the form treats it as read-only or falls back to the empty template.

### 2a. `src/hooks/useVendorRegistration.tsx`
- Line 26: extend `EDITABLE_STATUSES` to include `'returned_to_buyer'` so `canEdit` is `true` and `saveVendor` / `resubmitVendor` don't throw "Vendor cannot be edited in current status".
- Line 832: extend the "reset submission fields" branch (`existingStatus === 'draft' || 'returned_to_vendor'`) to also include `'returned_to_buyer'` so buyer edits patch the existing row instead of creating a new draft.

### 2b. `src/pages/VendorRegistration.tsx`
The hydration effect (lines 624–703) was already updated to include `returned_to_buyer` in `editableStatuses` and to treat it as an `isReturned` state. Verify (and keep) that behaviour:
- `setFormData(existingFormData)` runs for `returned_to_buyer`.
- `verifiedData` is pre-seeded whenever `pan` **and** `bank.accountNumber` are present (drop the `gstin` requirement so non-GST vendors also get green tiles and the Review step shows all sections).
- Land on the Review step with all steps marked completed for both `returned_to_vendor` and `returned_to_buyer`.

### 2c. New-application safety
No code change needed — the `initialFormData` reset only runs when there is no `existingVendor` for the current invitation/user, which is exactly the "new application" case. Confirm the Buyer's "Create Vendor" bootstrap still creates a fresh `vendor_invitations` row (existing behaviour in the on-behalf effect) so a new application never picks up an older draft.

---

## Files touched

Frontend
- `src/lib/sapPayloadBuilder.ts` (new helper + unify `getSapName1`)
- `src/pages/SAPSync.tsx`
- `src/components/sap/MultipleSapSyncDialog.tsx`
- `src/components/vendor/VendorSubmissionPreviewDialog.tsx`
- `src/lib/reports/loadVendorReport.ts`
- `src/hooks/useRealtimeUpdates.tsx`
- `src/hooks/useVendorRegistration.tsx`
- `src/pages/VendorRegistration.tsx` (verifiedData seeding condition)

Edge functions
- `supabase/functions/list-pending-approvals-by-stage/index.ts`
- `supabase/functions/sap-team-return-to-buyer/index.ts`
- `supabase/functions/sap-team-reject-vendor/index.ts`
- `supabase/functions/sync-vendor-to-sap/index.ts`

No database schema or RLS changes.

---

## Verification

- Build passes.
- On self-hosted server, redeploy the four edge functions listed above (existing helpers `scripts/lib/40-functions.sh`).
- Manual: create an on-behalf vendor, submit, reject at Finance 1 → Buyer sees the vendor in Rejected tab with the correct Trade Name; clicking **Edit & Resubmit** opens the form pre-filled with all GST / PAN / MSME / Bank / address data; resubmit re-enters the approval chain from the buyer stage.
