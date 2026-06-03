
-- Idempotent: drop both old and new policy names before recreating

-- buyer_scm_mappings
DROP POLICY IF EXISTS "User mgmt can delete buyer-scm mappings" ON public.buyer_scm_mappings;
DROP POLICY IF EXISTS "User mgmt can insert buyer-scm mappings" ON public.buyer_scm_mappings;
DROP POLICY IF EXISTS "User mgmt can read buyer-scm mappings" ON public.buyer_scm_mappings;
DROP POLICY IF EXISTS "User mgmt can update buyer-scm mappings" ON public.buyer_scm_mappings;
CREATE POLICY "User mgmt can read buyer-scm mappings" ON public.buyer_scm_mappings FOR SELECT TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'user_management') OR buyer_user_id = auth.uid() OR scm_manager_user_id = auth.uid());
CREATE POLICY "User mgmt can insert buyer-scm mappings" ON public.buyer_scm_mappings FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'user_management'));
CREATE POLICY "User mgmt can update buyer-scm mappings" ON public.buyer_scm_mappings FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'user_management'))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'user_management'));
CREATE POLICY "User mgmt can delete buyer-scm mappings" ON public.buyer_scm_mappings FOR DELETE TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'user_management'));

-- tenants
DROP POLICY IF EXISTS "Sharvi admins can manage all tenants" ON public.tenants;
DROP POLICY IF EXISTS "Admins can manage all tenants" ON public.tenants;
CREATE POLICY "Admins can manage all tenants" ON public.tenants FOR ALL TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'sharvi_admin_console'))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'sharvi_admin_console'));

-- approval_matrix_levels
DROP POLICY IF EXISTS "Sharvi admins manage all levels" ON public.approval_matrix_levels;
DROP POLICY IF EXISTS "Admins manage all approval levels" ON public.approval_matrix_levels;
CREATE POLICY "Admins manage all approval levels" ON public.approval_matrix_levels FOR ALL TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'user_management'))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'user_management'));

-- approval_matrix_approvers
DROP POLICY IF EXISTS "Sharvi admins manage all approvers" ON public.approval_matrix_approvers;
DROP POLICY IF EXISTS "Admins manage all approval approvers" ON public.approval_matrix_approvers;
CREATE POLICY "Admins manage all approval approvers" ON public.approval_matrix_approvers FOR ALL TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'user_management'))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'user_management'));

-- custom_roles
DROP POLICY IF EXISTS "Sharvi/admin manage all custom roles" ON public.custom_roles;
DROP POLICY IF EXISTS "Admins manage all custom roles" ON public.custom_roles;
CREATE POLICY "Admins manage all custom roles" ON public.custom_roles FOR ALL TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'custom_roles'))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'custom_roles'));

-- custom_role_screen_permissions
DROP POLICY IF EXISTS "Admins manage custom role permissions" ON public.custom_role_screen_permissions;
CREATE POLICY "Admins manage custom role permissions" ON public.custom_role_screen_permissions FOR ALL TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'custom_roles'))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'custom_roles'));

-- user_custom_roles
DROP POLICY IF EXISTS "Admins manage user custom roles" ON public.user_custom_roles;
CREATE POLICY "Admins manage user custom roles" ON public.user_custom_roles FOR ALL TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'user_management'))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'user_management'));

-- role_screen_permissions
DROP POLICY IF EXISTS "Admins manage role permissions" ON public.role_screen_permissions;
CREATE POLICY "Admins manage role permissions" ON public.role_screen_permissions FOR ALL TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'role_permissions'))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'role_permissions'));

-- form_step_configs
DROP POLICY IF EXISTS "Sharvi admins manage all step configs" ON public.form_step_configs;
DROP POLICY IF EXISTS "Admins manage all step configs" ON public.form_step_configs;
CREATE POLICY "Admins manage all step configs" ON public.form_step_configs FOR ALL TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'admin_configuration'))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'admin_configuration'));

-- sap_api_configs
DROP POLICY IF EXISTS "Admins manage sap_api_configs" ON public.sap_api_configs;
CREATE POLICY "Admins manage sap_api_configs" ON public.sap_api_configs FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'sharvi_admin'::app_role) OR has_screen_permission(auth.uid(),'sap_sync'))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'sharvi_admin'::app_role) OR has_screen_permission(auth.uid(),'sap_sync'));

-- sap_api_credentials
DROP POLICY IF EXISTS "Admins manage sap_api_credentials" ON public.sap_api_credentials;
CREATE POLICY "Admins manage sap_api_credentials" ON public.sap_api_credentials FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'sharvi_admin'::app_role) OR has_screen_permission(auth.uid(),'sap_sync'))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'sharvi_admin'::app_role) OR has_screen_permission(auth.uid(),'sap_sync'));

-- sap_api_request_fields
DROP POLICY IF EXISTS "Admins manage sap_api_request_fields" ON public.sap_api_request_fields;
CREATE POLICY "Admins manage sap_api_request_fields" ON public.sap_api_request_fields FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'sharvi_admin'::app_role) OR has_screen_permission(auth.uid(),'sap_sync'))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'sharvi_admin'::app_role) OR has_screen_permission(auth.uid(),'sap_sync'));

-- sap_api_response_fields
DROP POLICY IF EXISTS "Admins manage sap_api_response_fields" ON public.sap_api_response_fields;
CREATE POLICY "Admins manage sap_api_response_fields" ON public.sap_api_response_fields FOR ALL
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'sharvi_admin'::app_role) OR has_screen_permission(auth.uid(),'sap_sync'))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'sharvi_admin'::app_role) OR has_screen_permission(auth.uid(),'sap_sync'));

-- sap_default_fields
DROP POLICY IF EXISTS "Admins manage all sap defaults" ON public.sap_default_fields;
CREATE POLICY "Admins manage all sap defaults" ON public.sap_default_fields FOR ALL TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'sap_sync'))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'sap_sync'));

-- sap_payload_templates
DROP POLICY IF EXISTS "Admins manage all sap payload templates" ON public.sap_payload_templates;
CREATE POLICY "Admins manage all sap payload templates" ON public.sap_payload_templates FOR ALL TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'sap_sync'))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'sap_sync'));

-- vendors
DROP POLICY IF EXISTS "Sharvi admins can manage all vendors" ON public.vendors;
DROP POLICY IF EXISTS "Admins can manage all vendors" ON public.vendors;
CREATE POLICY "Admins can manage all vendors" ON public.vendors FOR ALL
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'vendors'))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'vendors'));

-- vendor_invitations
DROP POLICY IF EXISTS "Super admins manage all invitations" ON public.vendor_invitations;
CREATE POLICY "Super admins manage all invitations" ON public.vendor_invitations FOR ALL TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'vendor_invitations'))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'vendor_invitations'));

-- vendor_approval_progress
DROP POLICY IF EXISTS "Admins manage all progress" ON public.vendor_approval_progress;
CREATE POLICY "Admins manage all progress" ON public.vendor_approval_progress FOR ALL TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'user_management'))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role) OR has_screen_permission(auth.uid(),'user_management'));
