## Problem

When a buyer self-registers a vendor (on-behalf submission) and a downstream approver (e.g. SCM Manager) rejects it, the vendor lands in the buyer's **Rejected** tab on `Buyer Approval`. Today that tab only offers **Approve** and **Send to Vendor**. Clicking **Send to Vendor**:

- Sets `vendors.status = 'returned_to_vendor'` and emails the vendor.
- But on-behalf vendors have a placeholder email (`onbehalf+xxxx@placeholder.local`) and no real vendor user — the email goes nowhere and the record disappears from the buyer's screen with no way for anyone to edit/resubmit.

Additionally, the rejected-vendors table only shows the vendor name; the user wants the vendor ID displayed underneath the name so it can be referenced.

## Fix

### 1. Detect on-behalf vendors in the rejected list

In `supabase/functions/list-pending-approvals-by-stage/index.ts` (BUYER branch), join `vendor_invitations` for the returned-to-buyer vendors and return:

- `isOnBehalf: boolean` — from `vendor_invitations.created_on_behalf`
- `invitationId: string | null` — the latest invitation row id (needed to deep-link the on-behalf edit form)

Extend the `StageApprovalItem` type in `src/hooks/usePendingApprovalsByStage.tsx` with these two optional fields.

### 2. Replace "Send to Vendor" with "Edit & Resubmit" for on-behalf vendors

In `src/components/approvals/StageApprovalView.tsx`, inside `renderRejectedTable`:

- If `it.isOnBehalf` is true: render an **Edit & Resubmit** button (pencil icon) that navigates the buyer to `/vendor/registration?onBehalfOf={invitationId}`. The existing on-behalf load path in `VendorRegistration.tsx` already hydrates the draft from the prior submission so the buyer can edit and resubmit.
- Otherwise: keep the existing **Send to Vendor** button unchanged.

The **Approve** action remains available in both cases (it calls `buyer-reapprove-rejected`, which already re-seeds the chain regardless of on-behalf).

No backend changes needed for the edit path — `useVendorRegistration` already supports resubmission via `resubmitVendor`, and the existing vendor row will be loaded by the on-behalf invitation id.

### 3. Show vendor ID under vendor name

In the **Vendor** column of `renderRejectedTable` (and, for consistency, the pending/waiting tables rendered by `renderTable` in the same file), render a small `text-xs text-muted-foreground font-mono` line under the vendor name showing `it.vendorId`. Keep it copy-friendly.

## Files to change

- `supabase/functions/list-pending-approvals-by-stage/index.ts` — include `isOnBehalf` and `invitationId` in BUYER branch rejected items (and pending items for symmetry).
- `src/hooks/usePendingApprovalsByStage.tsx` — add `isOnBehalf?: boolean` and `invitationId?: string | null` to `StageApprovalItem`.
- `src/components/approvals/StageApprovalView.tsx` — conditional **Edit & Resubmit** button for on-behalf rejected vendors; show vendor ID under vendor name.

## Out of scope

- No DB migration. `vendor_invitations.created_on_behalf` and `vendors.status` semantics are unchanged.
- The non-on-behalf "Send to Vendor" flow is left intact.
