DROP POLICY IF EXISTS "Approvers view their level progress" ON public.vendor_approval_progress;

CREATE POLICY "Approvers view their level progress"
ON public.vendor_approval_progress
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.approval_matrix_approvers a
    WHERE a.level_id = vendor_approval_progress.level_id
      AND (
        a.user_id = auth.uid()
        OR lower(a.approver_email) = lower(auth.jwt() ->> 'email')
      )
  )
);