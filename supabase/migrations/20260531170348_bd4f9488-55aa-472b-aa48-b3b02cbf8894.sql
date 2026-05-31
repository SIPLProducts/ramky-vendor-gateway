-- Unstick vendors stuck in legacy *_rejected statuses caused by an older
-- deployment of process-approval-action. Reopen the immediate previous
-- approval level and move the vendor back into the active review queue.

WITH rej AS (
  SELECT p.vendor_id,
         p.level_number AS rej_level_number,
         p.comments     AS rej_comments,
         p.acted_by     AS rej_acted_by,
         p.acted_at     AS rej_acted_at,
         l.stage        AS rej_stage
  FROM public.vendor_approval_progress p
  JOIN public.approval_matrix_levels l ON l.id = p.level_id
  JOIN public.vendors v ON v.id = p.vendor_id
  WHERE p.status = 'rejected'
    AND v.status::text IN (
      'scm_manager_rejected','scm_head_rejected',
      'finance_1_rejected','finance_2_rejected','ceo_office_rejected'
    )
),
prev AS (
  SELECT DISTINCT ON (p.vendor_id)
         p.id           AS prev_id,
         p.vendor_id,
         p.level_id     AS prev_level_id,
         r.rej_comments,
         r.rej_stage,
         r.rej_acted_by,
         r.rej_acted_at
  FROM public.vendor_approval_progress p
  JOIN rej r ON r.vendor_id = p.vendor_id
            AND p.level_number < r.rej_level_number
  ORDER BY p.vendor_id, p.level_number DESC
)
UPDATE public.vendor_approval_progress vap
SET status               = 'pending',
    acted_by             = NULL,
    acted_at             = NULL,
    rejection_comments   = prev.rej_comments,
    rejection_from_stage = prev.rej_stage,
    rejection_from_user  = prev.rej_acted_by,
    rejection_at         = prev.rej_acted_at
FROM prev
WHERE vap.id = prev.prev_id;

-- Move vendor.status to the matching review status of the now-pending previous level.
WITH rej AS (
  SELECT p.vendor_id, p.comments, p.acted_by, p.acted_at, l.stage
  FROM public.vendor_approval_progress p
  JOIN public.approval_matrix_levels l ON l.id = p.level_id
  WHERE p.status = 'rejected'
),
prev_pending AS (
  SELECT DISTINCT ON (vap.vendor_id)
         vap.vendor_id, l.stage AS prev_stage
  FROM public.vendor_approval_progress vap
  JOIN public.approval_matrix_levels l ON l.id = vap.level_id
  WHERE vap.status = 'pending'
  ORDER BY vap.vendor_id, vap.level_number DESC
)
UPDATE public.vendors v
SET status = (CASE pp.prev_stage
                WHEN 'SCM_MANAGER' THEN 'scm_manager_review'
                WHEN 'SCM_HEAD'    THEN 'scm_head_review'
                WHEN 'FINANCE_1'   THEN 'finance_1_review'
                WHEN 'FINANCE_2'   THEN 'finance_2_review'
                WHEN 'CEO_OFFICE'  THEN 'ceo_office_review'
              END)::public.vendor_status,
    last_rejection_comments = r.comments,
    last_rejection_stage    = r.stage,
    last_rejected_by        = r.acted_by,
    last_rejected_at        = r.acted_at
FROM prev_pending pp
JOIN rej r ON r.vendor_id = pp.vendor_id
WHERE v.id = pp.vendor_id
  AND v.status::text IN (
    'scm_manager_rejected','scm_head_rejected',
    'finance_1_rejected','finance_2_rejected','ceo_office_rejected'
  );

-- First-stage rejections (no previous level): send back to inviting buyer.
WITH rej AS (
  SELECT p.vendor_id, p.comments, p.acted_by, p.acted_at, l.stage
  FROM public.vendor_approval_progress p
  JOIN public.approval_matrix_levels l ON l.id = p.level_id
  WHERE p.status = 'rejected'
),
no_prev AS (
  SELECT v.id AS vendor_id
  FROM public.vendors v
  WHERE v.status::text IN (
    'scm_manager_rejected','scm_head_rejected',
    'finance_1_rejected','finance_2_rejected','ceo_office_rejected'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.vendor_approval_progress vap
    WHERE vap.vendor_id = v.id AND vap.status = 'pending'
  )
)
UPDATE public.vendors v
SET status = 'returned_to_buyer'::public.vendor_status,
    last_rejection_comments = r.comments,
    last_rejection_stage    = r.stage,
    last_rejected_by        = r.acted_by,
    last_rejected_at        = r.acted_at
FROM no_prev np
JOIN rej r ON r.vendor_id = np.vendor_id
WHERE v.id = np.vendor_id;
