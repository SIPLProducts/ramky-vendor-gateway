

## Reorder approval flow: Purchase matrix (sequential) → Finance → SAP sync

### New flow
```text
Vendor submits
   ↓
purchase_review  (Purchase / SCM matrix — Level N → … → Level 1, sequential)
   ↓ (after final Purchase level approves)
finance_review   (single Finance approval)
   ↓ (Finance approves)
purchase_approved  (ready for SAP sync)
   ↓
sap_synced
```

Rejection at any stage → `purchase_rejected` (Purchase) or `finance_rejected` (Finance).
Finance "Clarify" still sends vendor back to `draft`.

### Changes

**1. Submission** — `src/hooks/useVendorRegistration.tsx`
- On submit, set vendor status to `purchase_review` (was `finance_review`).
- Immediately invoke `route-vendor-approval` so Purchase matrix levels are seeded as `pending` rows in `vendor_approval_progress`.

**2. Edge function** — `supabase/functions/process-approval-action/index.ts`
- When the final Purchase matrix level (level_number = 1) approves, set vendor status to `finance_review` (currently sets `purchase_approved`).
- Intermediate level approvals: no vendor status change (advance to next level only).
- Reject at any Purchase level → `purchase_rejected`.

**3. Finance action** — `src/hooks/useVendors.tsx` `useFinanceAction`
- `approve` → status `purchase_approved` (ready for SAP sync), set `finance_reviewed_by/at`.
- `reject` → `finance_rejected` (unchanged).
- `clarify` → unchanged (vendor back to `draft`).

**4. Purchase action page** — `src/pages/PurchaseApproval.tsx` / `useMyApprovals`
- Purchase approvers act through the matrix via `process-approval-action` (already wired). The legacy `usePurchaseAction` direct-approve is removed/disabled to prevent bypassing the matrix.

**5. SAP sync** — unchanged
- `useSAPSync` still triggers from vendors in `purchase_approved`.

**6. RLS migration**
- Update `Vendors can update own draft data` policy to allow status transition to `purchase_review` on submit:
  ```sql
  WITH CHECK (
    user_id = auth.uid()
    AND status = ANY (ARRAY[
      'draft','submitted','validation_pending','purchase_review'
    ]::vendor_status[])
  )
  ```

**7. Notifications** — `supabase/functions/send-status-notification/index.ts`
- Update copy: `purchase_review` = "Awaiting Purchase/SCM approval", `finance_review` = "Awaiting Finance review", `purchase_approved` = "Approved — pending SAP sync".

**8. Dashboard / labels**
- Stat buckets in `useVendorStats` already key off statuses; counts re-bucket automatically. Update wording on dashboard cards from "Pending Finance" / "Pending Purchase" to reflect new order.

### Out of scope
- No changes to SAP sync logic or Cloudflare Worker.
- No changes to approval matrix admin UI (admins continue configuring SCM/Purchase levels in Approval Matrix).
- No new tables.

### Files touched
- `src/hooks/useVendorRegistration.tsx`
- `src/hooks/useVendors.tsx`
- `src/pages/PurchaseApproval.tsx` (route through matrix only)
- `src/pages/Dashboard.tsx` (label tweaks)
- `supabase/functions/process-approval-action/index.ts`
- `supabase/functions/send-status-notification/index.ts`
- New migration: vendor submit RLS allows `purchase_review`

