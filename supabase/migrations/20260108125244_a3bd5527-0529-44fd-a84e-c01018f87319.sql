-- Step 1: Add new role enum values
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sharvi_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'customer_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'approver';