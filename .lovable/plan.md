## Goal

1. Fix the classification dropdowns (`Material Group for Vendors`, `Vendor Category`) so each option shows only the Proper Case description — not the ALL CAPS code + description pair.
2. Ensure buyer-selected classification values are saved on approval and correctly re-populated when the record is rejected from a later stage and returns to the buyer, both in the edit dropdowns and wherever the values are displayed.

## Changes

### 1. Show only Proper Case labels in Classification dropdowns
File: `src/components/vendor/ClassificationField.tsx`

- Update the `toOptions` mapping so the visible `label` is just `r.description` (falling back to `r.code` only when description is missing).
- The stored `value` remains `r.code` — no functional change to save/submit payloads or SAP mapping.

Effect: the dropdown will show `Admin Miscellaneous` instead of `ADMIN MISCELLANEOUS — Admin Miscellaneous`. Applies everywhere the component is used (vendor registration, buyer approval, on-behalf flow).

### 2. Buyer classification persistence + re-populate after rejection
Current state (already in place from prior work):
- `process-approval-action` and `buyer-reapprove-rejected` edge functions accept `material_group_vendors` / `vendor_categories` and persist them on the `vendors` row via service role.
- `StageApprovalView.tsx` prefills `buyerClassification` and `rejectedClassification` from the saved vendor row when the dialog opens.

Verification-only pass (no behavior change unless a gap is found while reading):
- Confirm the prefill reads the same columns the edge functions write to, so a rejected → buyer re-approval opens with the previously saved selections and the buyer can edit them.
- Confirm the read-only "Classification" display in `VendorReviewDialog` / approval detail views reflects the saved values (using the same descriptions, not the raw codes) after step 1's label change.

If any of those spots still show the raw code or fail to prefill on the rejection→buyer path, fix them in the same pass — scoped strictly to display/prefill of these two fields.

## Out of scope
- No schema changes.
- No changes to save payloads, SAP sync mapping, or other classification fields (Vendor Location, Identification Source) beyond the shared label formatting from step 1.
