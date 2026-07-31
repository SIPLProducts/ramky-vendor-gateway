CREATE TABLE IF NOT EXISTS public.vendor_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  stage text NOT NULL,
  level_number integer,
  action text NOT NULL,
  from_stage text,
  comments text,
  acted_by uuid,
  acted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.vendor_approval_history TO authenticated;
GRANT ALL ON public.vendor_approval_history TO service_role;

ALTER TABLE public.vendor_approval_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hist_select_visible_vendor" ON public.vendor_approval_history;
CREATE POLICY "hist_select_visible_vendor"
ON public.vendor_approval_history
FOR SELECT TO authenticated
USING (public.user_can_see_vendor(auth.uid(), vendor_id));

DROP POLICY IF EXISTS "hist_insert_self" ON public.vendor_approval_history;
CREATE POLICY "hist_insert_self"
ON public.vendor_approval_history
FOR INSERT TO authenticated
WITH CHECK (acted_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_vendor_approval_history_vendor_time
  ON public.vendor_approval_history (vendor_id, acted_at);

INSERT INTO public.vendor_approval_history
  (vendor_id, stage, level_number, action, from_stage, comments, acted_by, acted_at)
SELECT
  p.vendor_id,
  COALESCE(p.stage, 'SCM_MANAGER'),
  p.level_number,
  CASE WHEN p.status = 'approved' THEN 'approved' ELSE 'rejected' END,
  p.rejection_from_stage,
  COALESCE(p.comments, p.rejection_comments),
  COALESCE(p.acted_by, p.rejection_from_user),
  COALESCE(p.acted_at, p.rejection_at, p.created_at, now())
FROM public.vendor_approval_progress p
WHERE p.status IN ('approved', 'rejected')
  AND COALESCE(p.comments, p.rejection_comments) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.vendor_approval_history h
    WHERE h.vendor_id = p.vendor_id
      AND h.level_number IS NOT DISTINCT FROM p.level_number
      AND h.stage = COALESCE(p.stage, 'SCM_MANAGER')
      AND h.action = CASE WHEN p.status = 'approved' THEN 'approved' ELSE 'rejected' END
      AND h.comments IS NOT DISTINCT FROM COALESCE(p.comments, p.rejection_comments)
  );

NOTIFY pgrst, 'reload schema';