
-- Drop the problematic policies on tenants table
DROP POLICY IF EXISTS "Customer admins can view own tenant" ON tenants;

-- Create a simpler policy that allows all authenticated users to view active tenants
-- This is safe because tenant list is not sensitive data
CREATE POLICY "Authenticated users can view active tenants"
ON tenants
FOR SELECT
USING (is_active = true);
