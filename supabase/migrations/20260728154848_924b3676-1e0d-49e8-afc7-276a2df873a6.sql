
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

CREATE POLICY "hist_select_visible_vendor"
ON public.vendor_approval_history
FOR SELECT TO authenticated
USING (public.user_can_see_vendor(auth.uid(), vendor_id));

CREATE POLICY "hist_insert_self"
ON public.vendor_approval_history
FOR INSERT TO authenticated
WITH CHECK (acted_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_vendor_approval_history_vendor_time
  ON public.vendor_approval_history (vendor_id, acted_at);

-- One-time backfill from existing progress rows (only non-pending actions)
INSERT INTO public.vendor_approval_history
  (vendor_id, stage, level_number, action, from_stage, comments, acted_by, acted_at)
SELECT
  p.vendor_id,
  COALESCE(p.stage, 'SCM_MANAGER'),
  p.level_number,
  CASE
    WHEN p.status = 'approved' THEN 'approved'
    WHEN p.status = 'rejected' THEN 'rejected'
    ELSE p.status
  END,
  p.rejection_from_stage,
  COALESCE(p.comments, p.rejection_comments),
  p.acted_by,
  COALESCE(p.acted_at, p.created_at, now())
FROM public.vendor_approval_progress p
WHERE p.status IN ('approved','rejected')
  AND NOT EXISTS (
    SELECT 1 FROM public.vendor_approval_history h
    WHERE h.vendor_id = p.vendor_id
      AND h.level_number = p.level_number
      AND h.stage = COALESCE(p.stage,'SCM_MANAGER')
      AND h.action = CASE WHEN p.status='approved' THEN 'approved' ELSE 'rejected' END
      AND COALESCE(h.acted_at,'epoch') = COALESCE(p.acted_at, p.created_at, now())
  );
