## Goal

Replace the tenant-scoped Approval Matrix with a **per-buyer approval chain**. Each buyer configures their own pipeline:

```text
Buyer → SCM Manager → SCM Head → Finance 1 → Finance 2 → CEO Office
```

Each downstream stage may be skipped. Finance 2 keeps its existing MSME routing rule (MSME = goes to CEO Office, non-MSME = goes to SAP Sync). Approvers see only vendors routed through their own chain. Track how many days each vendor spends at every stage.

## Data Model Changes

1. **New table `public.buyer_approval_flows`** — one row per buyer.
   - `buyer_user_id` (unique), `tenant_id`
   - `scm_manager_user_id`, `scm_head_user_id`, `finance_1_user_id`, `finance_2_user_id`, `ceo_office_user_id`
   - `skip_scm_manager`, `skip_scm_head`, `skip_finance_1`, `skip_finance_2` (booleans; Buyer and CEO Office are not skippable, CEO Office still gated by MSME flag)
   - RLS: admin/sharvi_admin/customer_admin manage; the buyer can read their own row.

2. **Augment `public.vendor_approval_progress`**:
   - `started_at timestamptz` — set when row first becomes the active pending stage
   - `completed_at timestamptz` — set when status moves to approved/rejected
   - `duration_seconds integer generated` — convenience for reports

3. **Deprecate but keep**: `approval_matrix_levels`, `approval_matrix_approvers`, `buyer_scm_mappings.include_scm_stages/skip_buyer_stage`. They stay read-only for migration safety; new logic ignores them.

## Backend Logic

4. **Rewrite `seed_vendor_approval_progress(_vendor_id)`** to:
   - Look up the inviting buyer for the vendor.
   - Load that buyer's `buyer_approval_flows` row.
   - Insert progress rows in order: Buyer (auto-approved when on-behalf), then each non-skipped stage that has a configured approver. Finance 2 → CEO Office only when vendor is MSME and domestic (unchanged rule).
   - Stamp `started_at = now()` on the first pending row.
   - Update vendor `status` to match the first pending stage.

5. **Update `process-approval-action` edge function** to:
   - Set `completed_at = now()` on the row being approved/rejected.
   - Set `started_at = now()` on the next row that becomes pending.

6. **Rewrite `list-pending-approvals-by-stage`** to authorise by `buyer_approval_flows` instead of `approval_matrix_approvers`. For each stage:
   - Find all `buyer_user_id` where `<stage>_user_id = me` and the stage is not skipped.
   - List pending `vendor_approval_progress` rows whose vendor was invited by any of those buyers.
   - Buyer stage logic unchanged.

## Frontend Changes

7. **Replace `src/components/admin/ApprovalMatrixConfig.tsx`** with a Buyer-centric editor:
   - Buyer picker (lists users with the Buyer custom role in the active tenant).
   - 5 user dropdowns (SCM Manager, SCM Head, Finance 1, Finance 2, CEO Office) populated from users with the matching custom role.
   - Skip toggle next to SCM Manager, SCM Head, Finance 1, Finance 2.
   - Read-only "Buyer" row at the top shows the selected buyer.
   - Save writes one row to `buyer_approval_flows` (upsert on `buyer_user_id`).
   - Existing tabs/page wrapper around this component stay.

8. **Approval screens (Buyer / SCM Manager / SCM Head / Finance 1 / Finance 2 / CEO Office)** keep their files; they already use `usePendingApprovalsByStage`, which now silently uses the new authorisation logic.

9. **Approval Timeline component** (`src/components/vendor/ApprovalTimeline.tsx`) adds a "Days at stage" column derived from `started_at` / `completed_at` (or `now()` for the active row).

10. **Retire `BuyerScmMapping` tab** UI link (keep the file for now to avoid breaking imports) — its functionality is fully replaced by the new editor.

## Out of Scope (unchanged)

- Vendor Invitation, Vendor Submission form, SAP Sync, email notifications, custom roles, tenants, branding, KYC validations.

## Technical Notes

- Migration adds the new table with GRANTs (`authenticated`, `service_role`) and RLS policies; the two new columns on `vendor_approval_progress` are nullable, backfilled with `created_at` / `acted_at` for existing rows.
- `seed_vendor_approval_progress` keeps its current signature so the `trg_vendors_seed_approval` trigger and `route-vendor-approval` edge function continue to work.
- `list-pending-approvals-by-stage` keeps its response shape so no hook/page changes are needed besides the timeline addition.
