
## Goal

1. **Point 1** — On the **Buyer ↔ SCM** screen, add a checkbox per mapping (and a default per buyer) that controls which approval flow is followed:
   - **Checked** (Row 1 in screenshot): Buyer → L2-SCM → L1-SCM → Finance 1 → Finance 2 → (MSME → CEO Office) → SAP
   - **Unchecked** (Row 2): Buyer → Finance 1 → Finance 2 → (MSME → CEO Office) → SAP (skip SCM Manager + SCM Head)

2. **Point 2** — Auto-skip any approval stage that has **zero approvers configured** in the matrix:
   - If L1-SCM empty → go to Finance 1
   - If Finance 1 empty → go to Finance 2
   - If L1-SCM AND Finance 1 empty → go directly to Finance 2
   - Same auto-skip logic applies to any stage in the chain

3. **Do not touch** the Approval Matrix UI or the existing Buyer ↔ SCM table UI layout (screenshots 2 & 3). Only add the checkbox column + a single boolean on the mapping row.

## Scope boundaries

- No changes to `ApprovalMatrixConfig.tsx` rendering / approver editing.
- No changes to `process-approval-action` action semantics (only the seeded chain shape changes).
- Domestic vs International vendor flows are untouched.

---

## Implementation

### 1. Database migration

Add a per-mapping flag and a tenant-wide default:

```sql
ALTER TABLE public.buyer_scm_mappings
  ADD COLUMN include_scm_stages boolean NOT NULL DEFAULT true;
```

Rationale: when a vendor is invited by a buyer, we read that buyer's mapping row; the `include_scm_stages` flag decides whether SCM_MANAGER + SCM_HEAD levels are seeded. Default `true` preserves current behavior for existing rows.

### 2. Rework `public.seed_vendor_approval_progress(_vendor_id uuid)`

Update the existing function (new migration, replaces body) so that, when building the `ordered` CTE of approval levels for the vendor:

- **a.** Look up the buyer for this vendor via `vendor_invitations.created_by` (fallback: `vendors.user_id` → not a buyer, so default to "include SCM"). Then check `buyer_scm_mappings` for any row where `buyer_user_id = <buyer>` AND `tenant_id = v_tenant`. If any such row has `include_scm_stages = false`, set local `v_skip_scm := true`.

- **b.** When `v_skip_scm` is true, exclude levels whose `stage IN ('SCM_MANAGER','SCM_HEAD')`.

- **c.** **Auto-skip empty stages**: for each candidate level, `LEFT JOIN approval_matrix_approvers a ON a.level_id = l.id` and filter to levels where at least one approver row exists (`HAVING count(a.id) > 0`). This makes empty L1-SCM / Finance 1 / etc. drop out of the chain automatically, so the next configured stage becomes the next pending level.

- **d.** Renumber the remaining levels 1..N via `ROW_NUMBER()` as today, and set `vendors.status` to the first stage's review status (existing CASE mapping).

- **e.** If after filtering zero levels remain → behave as today (`RETURN 0, NULL`), keeping the vendor in its previous status so the caller can decide.

### 3. Update `process-approval-action/index.ts` AUTO-EXTEND block

The existing block re-checks `approval_matrix_levels` and inserts any newly added stages after an approval. Mirror the same two filters there:

- Skip `SCM_MANAGER` / `SCM_HEAD` levels when the vendor's buyer mapping has `include_scm_stages = false`.
- Skip any level that currently has zero rows in `approval_matrix_approvers`.

This keeps both the initial seeding path and the "matrix grew later" path consistent.

### 4. `BuyerScmMapping.tsx` UI

- **Add column** to the "Existing Mappings" table: `Include SCM in approval flow` with an inline `<Switch />` (or `<Checkbox />`) bound to `include_scm_stages`. Toggling immediately `UPDATE buyer_scm_mappings SET include_scm_stages = $1` for that row.
- **Add toggle** to the "Add Buyer ↔ SCM Manager Mapping" card, defaulting to `true` (checked), with helper text:
  > "When unchecked, vendors created by this buyer skip SCM Manager / SCM Head approvals and go directly to Finance 1."
- Insert the value alongside the existing insert call.

No other UI files change.

### 5. Manual verification

After deploy:
- Toggle the checkbox off for a buyer mapping, invite a new vendor, submit → vendor.status should land in `finance_1_review`, approval chain rows should contain only Finance 1 / Finance 2 (+ CEO if MSME).
- With checkbox on but `Finance 1` approver list empty → chain should contain SCM_MANAGER, SCM_HEAD, FINANCE_2 (Finance 1 skipped).

## Out of scope

- No new edge functions.
- No changes to vendor registration form.
- No changes to SAP payload builder.
- No changes to Domestic/International switching flow.
