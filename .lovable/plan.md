## 1. Approval Matrix — hide Company list under Buyer dropdown

**File:** `src/components/admin/ApprovalMatrixConfig.tsx`

- Remove the "Company: …" helper line shown below the Buyer dropdown (the `tenantLabelForUser(buyerId)` block — it currently renders every tenant the buyer belongs to and creates the long wall of company names in screenshot #1).
- Keep all other logic (filtering, save, approver scoping) intact.

## 2. Replace logo with new Ramky Group logo

- Save the uploaded WhatsApp image as `src/assets/ramky-logo.png`, **overwriting** the existing file. Every component already imports from `@/assets/ramky-logo.png` (Sidebar, Header, Auth, VendorLogin, VendorRegistration, MobileHeader, etc.), so no code changes are needed.
- Also overwrite `public/ramky-logo.png` so the PWA icon, push notifications, and Install page pick up the new logo.
- No favicon / manifest renaming — just file replacement.

## 3. Buyer "Send back for correction" on vendor submission

Already implemented end-to-end and exposed in the UI:

- Edge function `buyer-return-to-vendor` sets `vendors.status = 'returned_to_vendor'`, stores remarks, and emails the vendor.
- `StageApprovalView.tsx` (Buyer Approval screen) already wires the **Reject / Send Back** action to this function when a vendor application is in `buyer_review`.
- Vendor side already shows the rejection banner and re-opens the form for edit when status is `returned_to_vendor`.

**No code change needed** — will confirm in the response that this path already exists. If you'd like the button label or remarks dialog tweaked, tell me and I'll add it.

## 4. Route rejections of on-behalf (buyer-created) vendors back to the Buyer

Today, when any downstream stage (SCM Manager, SCM Head, Finance 1/2, CEO) rejects a vendor, `process-approval-action` sets the vendor to `returned_to_vendor` and notifies the vendor. For a self-registration that was actually filled by the buyer (`vendor_invitations.created_on_behalf = true`), the vendor has no portal access and the buyer should be the one to correct & resubmit.

**Changes:**

### a) Edge function: `supabase/functions/process-approval-action/index.ts`
- On rejection (any non-buyer stage), look up `vendor_invitations.created_on_behalf` for the vendor's latest invitation.
- If `created_on_behalf = true`:
  - Set `vendors.status = 'buyer_review'` (NOT `returned_to_vendor`).
  - Reset the BUYER row in `vendor_approval_progress` for that vendor back to `status = 'pending'` (clear `acted_by`, `acted_at`, `completed_at`, set `started_at = now()`), and reset all later stage rows back to `'pending'` with cleared actor fields so the chain restarts cleanly after the buyer re-approves.
  - Store the rejection comments in `vendors.last_rejection_comments` and the stage/actor for display in the buyer's review screen.
  - Send notification to the **buyer** (reuse existing `send-status-notification` or buyer notify template) instead of the vendor.
- Else (true self-reg by vendor): keep current `returned_to_vendor` behavior.

### b) Buyer Approval screen: `src/pages/approvals/BuyerApproval.tsx` + `StageApprovalView.tsx`
- When the buyer opens a vendor that was created on-behalf and is back in `buyer_review` due to a downstream rejection, surface:
  - A red banner showing the rejecting stage name + remarks (from `vendors.last_rejection_*` fields already present in schema).
  - An **"Edit Application"** button that opens the vendor registration form pre-filled (reuse existing `VendorRegistration` route in edit mode — it already supports loading an existing vendor by id) so the buyer can correct fields and resubmit.
- On resubmit by the buyer, call the existing `buyer-reapprove-rejected` edge function which already re-seeds the approval progress and restarts the chain.

### c) Vendor Registration page: `src/pages/VendorRegistration.tsx`
- Allow buyer (creator) to edit a vendor when:
  - `vendors.status IN ('buyer_review','returned_to_vendor')` AND the current user is the inviting buyer (`vendor_invitations.created_by = auth.uid()` and `created_on_behalf = true`).
- Already partially handles `returned_to_vendor` for vendors; extend the editable-status guard so buyers (not just vendor accounts) can open & save when the conditions above are met.

### d) RLS / policy check
- Confirm `vendors` UPDATE policy allows the original buyer (creator via `vendor_invitations.created_by`) to update the vendor record when status is `buyer_review`. If not, add an RLS policy: buyer can update vendors they created on behalf, while status is `buyer_review`.

## Technical notes

- No schema changes expected; `vendors.last_rejection_comments`, `last_rejection_stage`, `last_rejection_by`, and `vendor_invitations.created_on_behalf` already exist.
- Realtime hook `useVendorApprovalChain` will reflect the reset chain automatically.
- Emails: add a new template entry in `send-status-notification` for "vendor returned to buyer for correction" so buyers receive a proper message instead of the vendor template.

## Out of scope

- No changes to the approval matrix save flow, tenant filter, or other admin tabs.
- No UI redesign — only the company line removal and logo file swap for visual changes.
