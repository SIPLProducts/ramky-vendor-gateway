-- Fix remaining RLS policies for admin role

-- Drop existing policies that may conflict
DROP POLICY IF EXISTS "Admins can manage validations" ON public.vendor_validations;
DROP POLICY IF EXISTS "Admins can view all API logs" ON public.validation_api_logs;
DROP POLICY IF EXISTS "Admins can view all scheduled validations" ON public.scheduled_validations;
DROP POLICY IF EXISTS "Admins can manage scheduled validations" ON public.scheduled_validations;
DROP POLICY IF EXISTS "Admins can view all documents" ON public.vendor_documents;
DROP POLICY IF EXISTS "Admins can view all invitations" ON public.vendor_invitations;
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.vendor_invitations;
DROP POLICY IF EXISTS "Admins can view all feedback" ON public.vendor_feedback;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;

-- Recreate vendor_validations policy
CREATE POLICY "Admins can manage validations" 
ON public.vendor_validations 
FOR ALL 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'sharvi_admin') OR 
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'finance')
);

-- Recreate validation_api_logs policy
CREATE POLICY "Admins can view all API logs" 
ON public.validation_api_logs 
FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'sharvi_admin') OR 
  public.has_role(auth.uid(), 'admin')
);

-- Recreate scheduled_validations policies
CREATE POLICY "Admins can view all scheduled validations" 
ON public.scheduled_validations 
FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'sharvi_admin') OR 
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can manage scheduled validations" 
ON public.scheduled_validations 
FOR ALL 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'sharvi_admin') OR 
  public.has_role(auth.uid(), 'admin')
);

-- Recreate vendor_documents policy
CREATE POLICY "Admins can view all documents" 
ON public.vendor_documents 
FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'sharvi_admin') OR 
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'finance') OR
  public.has_role(auth.uid(), 'purchase')
);

-- Recreate vendor_invitations policies
CREATE POLICY "Admins can view all invitations" 
ON public.vendor_invitations 
FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'sharvi_admin') OR 
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'customer_admin')
);

CREATE POLICY "Admins can manage invitations" 
ON public.vendor_invitations 
FOR ALL 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'sharvi_admin') OR 
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'customer_admin')
);

-- Recreate vendor_feedback policy
CREATE POLICY "Admins can view all feedback" 
ON public.vendor_feedback 
FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'sharvi_admin') OR 
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'customer_admin')
);

-- Recreate profiles policy
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'sharvi_admin') OR 
  public.has_role(auth.uid(), 'admin') OR
  id = auth.uid()
);

-- Recreate user_roles policy
CREATE POLICY "Admins can view all user roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated 
USING (
  public.has_role(auth.uid(), 'sharvi_admin') OR 
  public.has_role(auth.uid(), 'admin') OR
  user_id = auth.uid()
);