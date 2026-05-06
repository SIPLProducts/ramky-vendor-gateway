-- 1. Add stage + msme flag
ALTER TABLE public.approval_matrix_levels
  ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'SCM_MANAGER',
  ADD COLUMN IF NOT EXISTS requires_msme boolean NOT NULL DEFAULT false;

ALTER TABLE public.approval_matrix_levels
  DROP CONSTRAINT IF EXISTS approval_matrix_levels_stage_check;
ALTER TABLE public.approval_matrix_levels
  ADD CONSTRAINT approval_matrix_levels_stage_check
  CHECK (stage IN ('SCM_MANAGER','SCM_HEAD','FINANCE_1','FINANCE_2','CEO_OFFICE'));

-- 2. Backfill: per tenant, the highest level_number = SCM_HEAD, others = SCM_MANAGER
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY level_number DESC) AS rn
  FROM public.approval_matrix_levels
)
UPDATE public.approval_matrix_levels l
SET stage = CASE WHEN r.rn = 1 THEN 'SCM_HEAD' ELSE 'SCM_MANAGER' END
FROM ranked r
WHERE l.id = r.id;

-- 3. Seed screen permission rows for the five new screens
INSERT INTO public.role_screen_permissions (role, screen_key, can_access, tenant_id)
SELECT r::app_role, s, false, NULL
FROM (VALUES
  ('vendor'),('finance'),('purchase'),('approver'),
  ('customer_admin'),('admin'),('sharvi_admin')
) roles(r),
(VALUES
  ('scm_manager_approval'),
  ('scm_head_approval'),
  ('finance1_approval'),
  ('finance2_approval'),
  ('ceo_approval')
) screens(s)
ON CONFLICT DO NOTHING;