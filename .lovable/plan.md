## Plan

### 1. Fix buyer classification persistence on approval / re-approval

#### Root cause (confirmed)

The buyer approve dialog and the "re-approve rejected" dialog both save Classification with a client-side call:

```ts
supabase.from('vendors').update({ material_group_vendor(s), vendor_category(ies) })
```

But there is **no RLS UPDATE policy on `public.vendors` that allows a buyer** to update the row while it is at `buyer_review` / `returned_to_buyer` / any rejected state. The existing UPDATE policies only cover `admin`/`sharvi_admin`, `finance` (in finance_review), `purchase` (in purchase_review) and the vendor themself (in draft-like states). The buyer's update therefore affects **0 rows** — silently succeeds, nothing persists. When the dialog is reopened after rejection, the prefill `SELECT` reads back empty classification, so the fields look "not fetched".

#### Fix

Move the Classification persistence off the client and into the two edge functions the buyer already calls (both use the service role and can update `vendors` unconditionally).

**Files changed:**
- `supabase/functions/process-approval-action/index.ts` — accept optional `classification: { material_group_vendors: string[]; vendor_categories: string[] }` and update the vendor row before the approval logic when it is present.
- `supabase/functions/buyer-reapprove-rejected/index.ts` — accept the same optional `classification` and update the vendor row before re-routing.
- `src/components/approvals/StageApprovalView.tsx` — remove the two client-side `supabase.from('vendors').update(...)` blocks and pass `classification` inside the `body` of `supabase.functions.invoke(...)` for both approve paths. Leave the prefill effects and validation UI unchanged.

### 2. Update View Details popup labels

**File:** `src/components/vendor/VendorReviewDialog.tsx`

- Rename the label **"Invited By (Buyer)"** to **"Invited By"**.
- Hide the **"Primary Buyer"** field (the conditionally rendered block for `originalBuyerName`).

### Out of scope

- No RLS changes (avoid widening buyer write access).
- No other UI, label, or validation changes.
- The unrelated security findings in the "More" panel are not touched by this fix.