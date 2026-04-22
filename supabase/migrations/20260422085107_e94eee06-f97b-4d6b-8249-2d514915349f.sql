ALTER TABLE public.approval_matrix_approvers
  ADD COLUMN IF NOT EXISTS approver_name text,
  ADD COLUMN IF NOT EXISTS approver_email text,
  ALTER COLUMN user_id DROP NOT NULL;