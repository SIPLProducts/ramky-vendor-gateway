# Plan

## 1. Sidebar label

- `src/components/layout/Sidebar.tsx`: change the nav item label `'SCM CO'` → `'SCM Approval'` (only this occurrence — page titles, badges, DB role, and all other UI stay as "SCM CO").

## 2. Fix vendor being able to edit while rejection is still with the buyer

Rejection flow today:
- Any approver rejects → `vendors.status = 'returned_to_buyer'`.
- Buyer reviews and clicks "Send to Vendor" → status flips to `'returned_to_vendor'`.

Bug: `'returned_to_buyer'` is currently treated as vendor-editable, so the vendor can edit the application before the buyer forwards it.

Fix — remove `returned_to_buyer` from vendor-editable status lists (keep `returned_to_vendor` editable):

- `src/hooks/useVendorRegistration.tsx`
  - `EDITABLE_STATUSES` (line 26): drop `'returned_to_buyer'`.
  - Line 624 local `editableStatuses`: drop `'returned_to_buyer'`.
- `src/pages/VendorRegistration.tsx`
  - The "jump to Review" branch (line 634) that treats `returned_to_buyer` the same as `returned_to_vendor`: restrict to `returned_to_vendor` only.
  - The rejection-banner block (line 1466) can keep showing for `returned_to_buyer` as read-only info — no edit affordance since `canEdit` will now be false.

Result: while status is `returned_to_buyer`, the vendor sees status + rejection remarks but cannot modify or resubmit the form. Editing unlocks only after the buyer clicks "Send to Vendor" (which sets `returned_to_vendor` via the existing `buyer-return-to-vendor` edge function).

## Out of scope
- No DB, RLS, or edge-function changes.
- No renaming beyond the single sidebar label.
