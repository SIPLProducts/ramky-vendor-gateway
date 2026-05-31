## Diagnosis

For vendor `BADE MURALI KRISHNA` (id `f829b283…`):

- Audit log shows `vendor_rejectd_at_finance_2` ran at 16:53.
- `vendor_approval_progress` chain: SCM_MANAGER ✓, SCM_HEAD ✓, FINANCE_1 ✓, FINANCE_2 = **rejected**.
- `vendors.status` = `finance_2_rejected` (legacy enum), and `last_rejection_*` columns are NULL.

The current source of `process-approval-action/index.ts` never sets `finance_2_rejected` and always reopens the previous progress row + sets vendor to `finance_1_review`. Nowhere else in the repo writes `_rejected` stage statuses. The only explanation is that the **deployed edge function is a stale prior version** — the recent reverse-rejection edits never re-deployed. That is why:

- The Finance 1 inbox is empty (no `pending` row at FINANCE_1).
- Vendor status is the old `finance_2_rejected` instead of `finance_1_review`.

## Fix

### 1. Force redeploy `process-approval-action`
Re-save (touch) `supabase/functions/process-approval-action/index.ts` so the platform redeploys the current code. Add a harmless comment change at the top so the file hash differs and the deploy pipeline picks it up. If a redeploy tool path is available it will be used instead, but a file edit reliably triggers redeployment.

### 2. Data fix for the stuck vendor (one-off migration)
For any vendor currently in a legacy `*_rejected` status whose chain has an immediately-previous `approved` level, reopen that previous level and bring the vendor back into the active review queue. SQL outline:

```sql
-- For vendor f829b283... and any similarly-stuck rows:
-- a) Reopen the immediate previous approved level as pending and stamp rejection metadata
WITH bad AS (
  SELECT v.id AS vendor_id, v.status::text AS s
  FROM vendors v
  WHERE v.status::text IN (
    'scm_manager_rejected','scm_head_rejected',
    'finance_1_rejected','finance_2_rejected','ceo_office_rejected'
  )
),
rej AS (
  SELECT p.*, l.stage
  FROM vendor_approval_progress p
  JOIN approval_matrix_levels l ON l.id=p.level_id
  JOIN bad b ON b.vendor_id=p.vendor_id
  WHERE p.status='rejected'
),
prev AS (
  SELECT DISTINCT ON (p.vendor_id) p.*
  FROM vendor_approval_progress p
  JOIN rej r ON r.vendor_id=p.vendor_id AND p.level_number < r.level_number
  ORDER BY p.vendor_id, p.level_number DESC
)
UPDATE vendor_approval_progress vap
SET status='pending', acted_by=NULL, acted_at=NULL,
    rejection_comments = r.comments,
    rejection_from_stage = r.stage,
    rejection_from_user  = r.acted_by,
    rejection_at         = r.acted_at
FROM prev pr
JOIN rej r ON r.vendor_id = pr.vendor_id
WHERE vap.id = pr.id;

-- b) Move vendor status to the matching review status and mirror banner fields
UPDATE vendors v
SET status = CASE pl.stage
      WHEN 'SCM_MANAGER' THEN 'scm_manager_review'
      WHEN 'SCM_HEAD'    THEN 'scm_head_review'
      WHEN 'FINANCE_1'   THEN 'finance_1_review'
      WHEN 'FINANCE_2'   THEN 'finance_2_review'
      WHEN 'CEO_OFFICE'  THEN 'ceo_office_review'
    END::vendor_status,
    last_rejection_comments = r.comments,
    last_rejection_stage    = r.stage,
    last_rejected_by        = r.acted_by,
    last_rejected_at        = r.acted_at
FROM vendor_approval_progress vap
JOIN approval_matrix_levels pl ON pl.id = vap.level_id
JOIN (
  SELECT p.vendor_id, p.comments, p.acted_by, p.acted_at, l.stage
  FROM vendor_approval_progress p
  JOIN approval_matrix_levels l ON l.id=p.level_id
  WHERE p.status='rejected'
) r ON r.vendor_id = v.id
WHERE vap.vendor_id = v.id
  AND vap.status   = 'pending'
  AND v.status::text IN (
    'scm_manager_rejected','scm_head_rejected',
    'finance_1_rejected','finance_2_rejected','ceo_office_rejected'
  );
```

For first-stage rejections (no previous level), set the vendor to `returned_to_buyer` and stamp the same metadata.

### 3. Verification
- Re-query `vendors` + `vendor_approval_progress` for `f829b283…`: status should be `finance_1_review` and the FINANCE_1 row pending with rejection comments populated.
- Reload `/approvals/finance-1` for `Grandhi Srinivas` — the vendor must appear in Pending with a "Returned from FINANCE_2" banner.
- Trigger a fresh Finance 2 → Reject on a test vendor and confirm the new deployment moves it back to Finance 1 directly (no `finance_2_rejected` row).

## Out of scope
No changes to UI, RLS, types, or other edge functions — the source already matches the desired behavior; only the deployment + a one-time data backfill are needed.
