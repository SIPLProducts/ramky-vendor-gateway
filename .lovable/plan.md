

## Fix the misleading "Finance Approved" badge on SCM Approval

### What you're seeing vs what is true

On the **SCM Approval** page, every vendor card shows a green **"Finance Approved"** badge — including SHARVI INFOTECH. That badge is hard‑coded and wrong.

The actual workflow already runs in the correct order:

```text
Vendor submits
  → validations pass
  → status = purchase_review     ← SCM matrix approves here (Brijesh → soumendukumar)
  → status = finance_review      ← Finance reviews
  → status = purchase_approved   ← Ready for SAP sync
  → status = sap_synced
```

So Finance happens **after** SCM, exactly as you want. Only the badge label is lying.

### Root cause

`src/pages/PurchaseApproval.tsx` line 230 renders a static badge regardless of vendor state:

```tsx
<Badge className="bg-green-100 text-green-700 border-green-200">Finance Approved</Badge>
```

These vendors are actually in `purchase_review` and have **not** been to Finance.

### Fix

#### 1) Replace the static badge with an accurate, status‑driven one
In `src/pages/PurchaseApproval.tsx`:

- Remove the hard‑coded "Finance Approved" badge.
- Show **"Awaiting SCM Approval"** (amber) for vendors in `purchase_review`.
- If at least one SCM matrix level has already been approved for that vendor (intermediate level done), show **"SCM L{n} Approved · Pending L{n‑1}"** to reflect multi‑level progress.
- Keep the existing "No SCM approval matrix configured" alert untouched.

#### 2) Tighten copy on Finance Review for symmetry
In `src/pages/FinanceReview.tsx`, the page subtitle already says "after Purchase/SCM approval" — keep as is. No status logic change needed because Finance only loads `finance_review` + `validation_failed`, which is correct.

#### 3) Confirm no backend change is needed
- `useVendorRegistration` already routes new submissions to `purchase_review` first.
- `process-approval-action` already promotes `purchase_review → finance_review` only after the **final** SCM level (level_number = 1) approves.
- `useFinanceAction` already promotes `finance_review → purchase_approved` after Finance approve.

So this is a pure UI label fix — no DB migration, no edge function change.

### Files to update

- `src/pages/PurchaseApproval.tsx` — replace static badge with status‑aware badge using `vendor_approval_progress` rows already loaded for the stuck‑detection query.

### Acceptance checks

1. Open **SCM Approval** while a RIL vendor sits in `purchase_review`.
2. Card shows **"Awaiting SCM Approval"**, not "Finance Approved".
3. After Brijesh approves L2, card refreshes and shows **"SCM L2 Approved · Pending L1"** (or similar) until soumendukumar acts.
4. After L1 approves, vendor disappears from SCM Approval and appears on **Finance Review**.
5. After Finance approves, vendor moves to **SAP Sync** queue.

### Out of scope

- No change to approval routing order (already correct).
- No change to RLS, edge functions, or DB schema.
- No change to Finance Review page logic.

