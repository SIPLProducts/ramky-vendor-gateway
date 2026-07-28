## Vendor Reassignment on Buyer Inactive/Delete

### Schema change
- Add `original_created_by uuid` to `public.vendor_invitations` (nullable, references `auth.users`).
- Backfill: leave NULL for existing rows (means "same as current created_by").

### Edge Function: `reassign-user-work`
When a buyer is marked Inactive/Deleted with a replacement selected:
1. For every `vendor_invitations` row where `created_by = <old_buyer>`:
   - If `original_created_by IS NULL` → set it to the old buyer (preserve first inviter).
   - Set `created_by = <replacement_buyer>`.
2. Existing reassignment of `buyer_approval_flows` and `buyer_scm_mappings` continues as today.
3. Return counts (invitations transferred, flows reassigned) for the UI toast.

### Approval matrix behavior after reassignment (your question)
This is the important part — approvals follow the **current** `created_by`, not the original:

- `buyer_visible_vendor_ids` and `approver_visible_vendor_ids` both key off `vendor_invitations.created_by`. Once we flip `created_by` to Divyabharathi:
  - Divyabharathi sees Sunil's old vendors in her Buyer dashboard.
  - The downstream approvers (SCM Manager, SCM Head, Finance 1/2, CEO Office) are resolved from `buyer_approval_flows` for **Divyabharathi's** row — so her SCM/Finance chain becomes the active chain for those vendors going forward.
  - Sunil's approvers lose visibility to those vendors (correct — Sunil is inactive).
- Pending approval steps already seeded in `vendor_approval_progress` are **not** rewritten. Two sub-options — pick one:
  - **A. Leave in-flight approvals as-is** (recommended). Vendors still mid-approval keep the stage rows already generated from Sunil's flow; only *new* submissions or *returned-to-vendor* resubmits use Divyabharathi's flow (because `seed_vendor_approval_progress` re-reads the buyer flow on resubmit — and it reads by the invitation's current `created_by`, which is now Divyabharathi).
  - **B. Re-seed active approvals** for vendors currently in a review status, so Divyabharathi's chain takes over immediately. Higher risk of losing already-completed approvals — do only if you want a clean cutover.

Default: **Option A**. Confirm if you want B instead.

- Buyer-stage approval itself: if a vendor is currently sitting at `BUYER` stage (waiting for Sunil), that pending `vendor_approval_progress` row has no `acted_by` yet. Because visibility is now Divyabharathi's, **she can approve it** — the RLS policy checks that the acting user is the current buyer via `vendor_invitations.created_by`. Other reviewers (SCM/Finance/CEO) can approve their own stages exactly as before, based on Divyabharathi's `buyer_approval_flows`.

### UI
- `ReplaceUserDialog.tsx`: after reassignment success, toast shows "X invitations transferred to <replacement>".
- `VendorList.tsx` details popup: show `Original Invited By` row **only if** `original_created_by` is set AND different from current `created_by`. Otherwise hide it.
- `useVendors.tsx`: join to fetch both profiles (current + original) via `vendor_invitations`.
- No change to Buyer column in the main table — it keeps showing current `Invited By`.

### Files touched
- Migration: add column + index on `original_created_by`.
- `supabase/functions/reassign-user-work/index.ts` — extend reassignment block.
- `src/components/admin/ReplaceUserDialog.tsx` — surface invitation count.
- `src/hooks/useVendors.tsx` — select `original_created_by` + joined profile.
- `src/pages/VendorList.tsx` (details popup) — conditional row.

### Example (answering your question)
- Sunil invited Vendor V1. V1 is at SCM Manager review under Sunil's flow.
- Admin marks Sunil Inactive → picks Divyabharathi as replacement.
- After save: `vendor_invitations.created_by = Divyabharathi`, `original_created_by = Sunil`.
- Divyabharathi sees V1 in her dashboard. The SCM Manager currently assigned (from Sunil's flow) continues to approve the pending step. Once V1 progresses, remaining stages use whichever chain is already seeded (Option A). If V1 gets returned to vendor and resubmitted, the fresh seed will use **Divyabharathi's** approval flow.
- Details popup shows: Invited By: Divyabharathi • Original Invited By: Sunil.
- If Divyabharathi is later replaced by Ramesh: `created_by = Ramesh`, `original_created_by` stays Sunil.

Approve to implement with Option A (in-flight approvals preserved).
