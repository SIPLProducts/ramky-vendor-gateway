-- Main SAP API config table
CREATE TABLE public.sap_api_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  base_url TEXT NOT NULL DEFAULT '',
  endpoint_path TEXT NOT NULL DEFAULT '',
  http_method TEXT NOT NULL DEFAULT 'POST',
  auth_type TEXT NOT NULL DEFAULT 'Basic',
  sap_client TEXT DEFAULT '100',
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  connection_mode TEXT NOT NULL DEFAULT 'proxy',
  deployment_mode TEXT NOT NULL DEFAULT 'cloud',
  middleware_url TEXT,
  middleware_port INTEGER,
  proxy_secret TEXT,
  list_endpoint TEXT,
  create_endpoint TEXT,
  update_endpoint TEXT,
  update_method TEXT DEFAULT 'PATCH',
  key_field TEXT,
  api_type TEXT NOT NULL DEFAULT 'sync',
  auto_sync_enabled BOOLEAN NOT NULL DEFAULT false,
  schedule_cron TEXT,
  last_synced_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sap_api_request_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.sap_api_configs(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  source TEXT,
  default_value TEXT,
  required BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sap_api_response_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL REFERENCES public.sap_api_configs(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  target_column TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sap_api_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_id UUID NOT NULL UNIQUE REFERENCES public.sap_api_configs(id) ON DELETE CASCADE,
  username TEXT,
  password_encrypted TEXT,
  extra_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sap_api_request_fields_config ON public.sap_api_request_fields(config_id);
CREATE INDEX idx_sap_api_response_fields_config ON public.sap_api_response_fields(config_id);

-- Enable RLS
ALTER TABLE public.sap_api_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sap_api_request_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sap_api_response_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sap_api_credentials ENABLE ROW LEVEL SECURITY;

-- Policies: admin or sharvi_admin only
CREATE POLICY "Admins manage sap_api_configs"
  ON public.sap_api_configs FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sharvi_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sharvi_admin'));

CREATE POLICY "Admins manage sap_api_request_fields"
  ON public.sap_api_request_fields FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sharvi_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sharvi_admin'));

CREATE POLICY "Admins manage sap_api_response_fields"
  ON public.sap_api_response_fields FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sharvi_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sharvi_admin'));

CREATE POLICY "Admins manage sap_api_credentials"
  ON public.sap_api_credentials FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sharvi_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'sharvi_admin'));

-- Triggers for updated_at
CREATE TRIGGER update_sap_api_configs_updated_at
  BEFORE UPDATE ON public.sap_api_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sap_api_request_fields_updated_at
  BEFORE UPDATE ON public.sap_api_request_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sap_api_response_fields_updated_at
  BEFORE UPDATE ON public.sap_api_response_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sap_api_credentials_updated_at
  BEFORE UPDATE ON public.sap_api_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();