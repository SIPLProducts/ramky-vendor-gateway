-- Fix the overly permissive INSERT policy
DROP POLICY IF EXISTS "Service role can insert logs" ON public.validation_api_logs;

-- Create a more restrictive INSERT policy - authenticated users can insert logs
CREATE POLICY "Authenticated users can insert validation logs"
ON public.validation_api_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM vendors 
    WHERE vendors.id = validation_api_logs.vendor_id 
    AND (
      vendors.user_id = auth.uid() 
      OR has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'finance'::app_role)
    )
  )
);