## Goal

Make it obvious to the Buyer that clicking the red action at the Buyer Approval stage will return the application to the vendor for correction (not permanently reject it). Backend behavior is already correct — only UI wording changes.

## Background

When the Buyer clicks **Reject** on the Buyer Approval screen today, `process-approval-action` already:
- Marks the buyer approval row as `rejected`
- Sets `vendors.status = returned_to_vendor`
- Emails the vendor via `send-status-notification` so they can log in, fix the issues, and resubmit
- Logs `vendor_buyer_rejected` in `audit_logs`

So "Reject" at the Buyer stage **is** the "send back to vendor" flow. The label is just misleading. At later stages (SCM Manager / SCM Head / Finance / CEO) Reject means "return to the Buyer" — that behavior must stay unchanged.

## Changes (UI-only, scoped to `BUYER` stage)

File: `src/components/approvals/StageApprovalView.tsx`

1. When `stage === 'BUYER'`, render the destructive action as **"Send Back to Vendor"** with a return-arrow icon (e.g. `Undo2` or `RotateCcw`) instead of `XCircle` + "Reject". For all other stages, keep "Reject" + `XCircle` as-is.
2. In the confirmation dialog opened by `setActionItem({ item, action: 'reject' })`:
   - Title at Buyer stage → `Send back to vendor — {vendorName}`
   - Body copy → "The vendor will receive an email and can edit the form and resubmit. Please add remarks describing what needs to be corrected."
   - Make the remarks textarea **required** at Buyer stage (disable the confirm button until non-empty) — the vendor needs to know what to fix. Other stages keep the current "recommended" behavior.
   - Confirm button label at Buyer stage → `Send Back to Vendor`. Other stages keep `Reject`.
3. No changes to the API call — it still invokes `process-approval-action` with `action: 'reject'`. Toast message at Buyer stage updates to "Sent back to vendor".

## Out of scope (not touched)

- `supabase/functions/process-approval-action/index.ts` — already correct.
- `buyer-return-to-vendor` edge function — used only from the "Rejected" tab when a downstream approver returned the vendor to the Buyer; unchanged.
- Approval chain / matrix / seeding logic.
- Reject behavior at SCM Manager, SCM Head, Finance 1/2, CEO Office.
- Vendor-side resubmit flow (already works via `trg_vendors_seed_approval` on `returned_to_vendor → buyer_review`).

## Verification

1. Buyer approval list → click red action → dialog now says "Send back to vendor", remarks required.
2. Submit → vendor status becomes `returned_to_vendor`, vendor receives email, item moves out of Buyer's pending list.
3. Vendor logs in, edits, resubmits → returns to Buyer's Pending Approval tab.
4. Confirm SCM Manager / Finance Reject buttons still say "Reject" and still return to Buyer (no regression).
