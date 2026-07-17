## Clarification
The email template in `sap-team-reject-vendor/index.ts` **already renders the "Existing Vendor Details" table** and it stays exactly as-is. I will not touch the email HTML. The gap is only on the **UI** — the SAP Sync → Duplicate & Closed tab doesn't show that block because we never persisted `existingVendorText` to the vendor row. This plan only adds persistence + UI display.

---

## 1. Delete icon for "On behalf" invitations

**File:** `src/pages/AdminInvitations.tsx` (Actions cell, ~lines 1046–1077)

- For rows where `invitation.created_on_behalf === true`, render a red `Trash2` icon button next to "Resume".
- Click → confirm dialog ("Delete this on-behalf draft? This removes the invitation and its draft vendor.").
- On confirm:
  1. If `invitation.vendor_id` set → delete `vendors` where `id = vendor_id` AND `status = 'draft'` (never touch submitted vendors).
  2. Delete `vendor_invitations` by `id`.
  3. Toast success + `queryClient.invalidateQueries(['vendor-invitations'])`.
- Only on-behalf rows get the delete icon. Non-on-behalf rows keep the current Resend button unchanged.

## 2. Show "Existing Vendor Details" table in Duplicate & Closed tab

### Backend (persist only — email untouched)

**Migration:** add nullable column `vendors.sap_duplicate_details text`.

**`supabase/functions/sap-team-reject-vendor/index.ts`** — one small change only:
- In the vendor UPDATE block (~lines 69–78), also set `sap_duplicate_details: existingVendorText || null`.
- The entire email HTML (headline, `existingBlock`, closed-details table, etc.) stays exactly as it is today.

### Frontend

**`src/pages/SAPSync.tsx`** — Duplicate & Closed cards (~lines 722–762):
- Read `vendor.sap_duplicate_details`.
- Parse with the same splitter used in the edge function: split on `" - "` / `" – "` → `[SAP Code, Name, PAN, GSTIN]`.
- Render a new panel **above** the existing "Duplicate & Close Remarks" block:

  ```
  Existing Vendor Details (from SAP)
  ┌──────────────────┬─────────────────────┐
  │ SAP Vendor Code  │ 1007529             │
  │ Vendor Name      │ Foss India Pvt.Ltd. │
  │ PAN Number       │ AABCF1735D          │
  │ GSTIN            │ 27AABCF1735D1Z2     │
  └──────────────────┴─────────────────────┘
  ```

  Uses existing card styling (muted headers, mono for codes). If fewer than 4 parts parse, show a single "Details" row with the raw string. If `sap_duplicate_details` is empty (older records), hide the block.
- The current block (name, ref no, GSTIN, closed date, remarks) stays **below**, unchanged.

## Explicitly NOT changing
- Email HTML in `sap-team-reject-vendor` (already correct).
- DMS sync, bulk sync, middleware, invitations schema.
- Any non-on-behalf invitation row behavior.

## Files touched
- `src/pages/AdminInvitations.tsx`
- `src/pages/SAPSync.tsx`
- `supabase/functions/sap-team-reject-vendor/index.ts` (one-line addition in UPDATE payload)
- New migration: add `vendors.sap_duplicate_details`
