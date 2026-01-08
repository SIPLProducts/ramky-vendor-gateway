-- Step 2: Create Enterprise Multi-Tenant Tables

-- Tenants/Customers table
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tenant Branding Configuration
CREATE TABLE public.tenant_branding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#0066cc',
  secondary_color text DEFAULT '#f5f5f5',
  accent_color text DEFAULT '#ff6600',
  company_name text,
  tagline text,
  footer_text text,
  help_email text,
  help_phone text,
  terms_url text,
  privacy_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id)
);

-- API Provider Configurations (plug-and-play compliance APIs)
CREATE TABLE public.api_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  display_name text NOT NULL,
  is_enabled boolean DEFAULT true,
  is_mandatory boolean DEFAULT false,
  execution_order integer DEFAULT 1,
  base_url text NOT NULL,
  endpoint_path text NOT NULL,
  http_method text DEFAULT 'POST',
  auth_type text DEFAULT 'API_KEY',
  auth_header_name text DEFAULT 'Authorization',
  auth_header_prefix text DEFAULT 'Bearer',
  request_headers jsonb DEFAULT '{}',
  request_body_template jsonb DEFAULT '{}',
  response_success_path text,
  response_success_value text DEFAULT 'true',
  response_message_path text,
  response_data_mapping jsonb DEFAULT '{}',
  timeout_seconds integer DEFAULT 30,
  retry_count integer DEFAULT 3,
  retry_delay_ms integer DEFAULT 1000,
  schedule_enabled boolean DEFAULT false,
  schedule_frequency_days integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, provider_name)
);

-- Secure API Credentials Storage
CREATE TABLE public.api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_provider_id uuid REFERENCES public.api_providers(id) ON DELETE CASCADE NOT NULL,
  credential_name text NOT NULL,
  credential_value text NOT NULL,
  is_encrypted boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(api_provider_id, credential_name)
);

-- Dynamic Form Field Configuration
CREATE TABLE public.form_field_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  step_name text NOT NULL,
  field_name text NOT NULL,
  display_label text NOT NULL,
  field_type text DEFAULT 'text',
  is_visible boolean DEFAULT true,
  is_mandatory boolean DEFAULT false,
  is_editable boolean DEFAULT true,
  display_order integer DEFAULT 1,
  placeholder text,
  help_text text,
  validation_regex text,
  validation_message text,
  options jsonb,
  default_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, step_name, field_name)
);

-- Approval Workflow Configuration
CREATE TABLE public.approval_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  workflow_name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Approval Workflow Steps
CREATE TABLE public.approval_workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES public.approval_workflows(id) ON DELETE CASCADE NOT NULL,
  step_order integer NOT NULL,
  step_name text NOT NULL,
  required_role app_role NOT NULL,
  is_mandatory boolean DEFAULT true,
  can_reject boolean DEFAULT true,
  can_request_info boolean DEFAULT true,
  auto_approve_after_days integer,
  notify_on_pending boolean DEFAULT true,
  notify_on_complete boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workflow_id, step_order)
);

-- User-Tenant Association
CREATE TABLE public.user_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

-- Add tenant_id to vendors table
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- Enable RLS on all new tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_field_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tenants ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Sharvi admins can manage all tenants" ON public.tenants
  FOR ALL USING (has_role(auth.uid(), 'sharvi_admin'));

CREATE POLICY "Customer admins can view own tenant" ON public.tenants
  FOR SELECT USING (
    id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
  );

CREATE POLICY "Sharvi admins can manage all branding" ON public.tenant_branding
  FOR ALL USING (has_role(auth.uid(), 'sharvi_admin'));

CREATE POLICY "Customer admins can manage own branding" ON public.tenant_branding
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
    AND (has_role(auth.uid(), 'customer_admin') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Users can view tenant branding" ON public.tenant_branding
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
  );

CREATE POLICY "Sharvi admins can manage all API providers" ON public.api_providers
  FOR ALL USING (has_role(auth.uid(), 'sharvi_admin'));

CREATE POLICY "Customer admins can view own API providers" ON public.api_providers
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
  );

CREATE POLICY "Sharvi admins can manage credentials" ON public.api_credentials
  FOR ALL USING (has_role(auth.uid(), 'sharvi_admin'));

CREATE POLICY "Sharvi admins can manage all field configs" ON public.form_field_configs
  FOR ALL USING (has_role(auth.uid(), 'sharvi_admin'));

CREATE POLICY "Customer admins can manage own field configs" ON public.form_field_configs
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
    AND (has_role(auth.uid(), 'customer_admin') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Users can view field configs" ON public.form_field_configs
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
    OR tenant_id IS NULL
  );

CREATE POLICY "Sharvi admins can manage all workflows" ON public.approval_workflows
  FOR ALL USING (has_role(auth.uid(), 'sharvi_admin'));

CREATE POLICY "Customer admins can manage own workflows" ON public.approval_workflows
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
    AND (has_role(auth.uid(), 'customer_admin') OR has_role(auth.uid(), 'admin'))
  );

CREATE POLICY "Sharvi admins can manage all workflow steps" ON public.approval_workflow_steps
  FOR ALL USING (has_role(auth.uid(), 'sharvi_admin'));

CREATE POLICY "Users can view workflow steps" ON public.approval_workflow_steps
  FOR SELECT USING (
    workflow_id IN (
      SELECT id FROM public.approval_workflows 
      WHERE tenant_id IN (SELECT tenant_id FROM public.user_tenants WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Sharvi admins can manage user tenants" ON public.user_tenants
  FOR ALL USING (has_role(auth.uid(), 'sharvi_admin'));

CREATE POLICY "Customer admins can manage own tenant users" ON public.user_tenants
  FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM public.user_tenants ut WHERE ut.user_id = auth.uid())
    AND has_role(auth.uid(), 'customer_admin')
  );

CREATE POLICY "Users can view own tenant associations" ON public.user_tenants
  FOR SELECT USING (user_id = auth.uid());

-- Update triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_branding_updated_at BEFORE UPDATE ON public.tenant_branding
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_providers_updated_at BEFORE UPDATE ON public.api_providers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_credentials_updated_at BEFORE UPDATE ON public.api_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_form_field_configs_updated_at BEFORE UPDATE ON public.form_field_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();