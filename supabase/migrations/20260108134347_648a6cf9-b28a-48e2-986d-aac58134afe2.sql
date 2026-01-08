-- Add sharvi_admin to vendor viewing policies
DROP POLICY IF EXISTS "Sharvi admins can view all vendors" ON public.vendors;
CREATE POLICY "Sharvi admins can view all vendors" 
ON public.vendors 
FOR SELECT 
USING (has_role(auth.uid(), 'sharvi_admin'::app_role));

DROP POLICY IF EXISTS "Sharvi admins can manage all vendors" ON public.vendors;
CREATE POLICY "Sharvi admins can manage all vendors" 
ON public.vendors 
FOR ALL 
USING (has_role(auth.uid(), 'sharvi_admin'::app_role));

-- Also add sharvi_admin to audit_logs viewing
DROP POLICY IF EXISTS "Sharvi admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Sharvi admins can view all audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'sharvi_admin'::app_role));

-- Add sharvi_admin to vendor_validations viewing
DROP POLICY IF EXISTS "Sharvi admins can view all validations" ON public.vendor_validations;
CREATE POLICY "Sharvi admins can view all validations" 
ON public.vendor_validations 
FOR SELECT 
USING (has_role(auth.uid(), 'sharvi_admin'::app_role));

-- Add sharvi_admin to validation_api_logs viewing
DROP POLICY IF EXISTS "Sharvi admins can view all validation logs" ON public.validation_api_logs;
CREATE POLICY "Sharvi admins can view all validation logs" 
ON public.validation_api_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'sharvi_admin'::app_role));

-- Add sharvi_admin to scheduled_validations viewing
DROP POLICY IF EXISTS "Sharvi admins can manage scheduled validations" ON public.scheduled_validations;
CREATE POLICY "Sharvi admins can manage scheduled validations" 
ON public.scheduled_validations 
FOR ALL 
USING (has_role(auth.uid(), 'sharvi_admin'::app_role));

-- Add sharvi_admin to vendor_documents viewing
DROP POLICY IF EXISTS "Sharvi admins can view all documents" ON public.vendor_documents;
CREATE POLICY "Sharvi admins can view all documents" 
ON public.vendor_documents 
FOR SELECT 
USING (has_role(auth.uid(), 'sharvi_admin'::app_role));

-- Add sharvi_admin to vendor_invitations viewing
DROP POLICY IF EXISTS "Sharvi admins can manage invitations" ON public.vendor_invitations;
CREATE POLICY "Sharvi admins can manage invitations" 
ON public.vendor_invitations 
FOR ALL 
USING (has_role(auth.uid(), 'sharvi_admin'::app_role));

-- Add sharvi_admin to vendor_feedback viewing
DROP POLICY IF EXISTS "Sharvi admins can view all feedback" ON public.vendor_feedback;
CREATE POLICY "Sharvi admins can view all feedback" 
ON public.vendor_feedback 
FOR SELECT 
USING (has_role(auth.uid(), 'sharvi_admin'::app_role));