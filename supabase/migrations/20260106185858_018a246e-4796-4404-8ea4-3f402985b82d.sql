-- Create validation_configs table for config-driven validations
CREATE TABLE public.validation_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  validation_type TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  execution_stage TEXT NOT NULL DEFAULT 'ON_SUBMIT' CHECK (execution_stage IN ('ON_SUBMIT', 'SCHEDULED', 'BOTH')),
  api_provider TEXT,
  api_endpoint TEXT,
  matching_threshold NUMERIC DEFAULT 80,
  retry_count INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  schedule_frequency_days INTEGER,
  priority_order INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.validation_configs ENABLE ROW LEVEL SECURITY;

-- Everyone can read configs
CREATE POLICY "Everyone can view validation configs" 
ON public.validation_configs 
FOR SELECT 
USING (true);

-- Only admins can manage configs
CREATE POLICY "Admins can manage validation configs" 
ON public.validation_configs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create validation_api_logs table for audit trail
CREATE TABLE public.validation_api_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  validation_type TEXT NOT NULL,
  api_provider TEXT,
  request_payload JSONB,
  response_payload JSONB,
  response_status INTEGER,
  execution_time_ms INTEGER,
  is_success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.validation_api_logs ENABLE ROW LEVEL SECURITY;

-- Admins can manage all logs
CREATE POLICY "Admins can manage validation logs" 
ON public.validation_api_logs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Finance and Purchase can view logs
CREATE POLICY "Finance and Purchase can view validation logs" 
ON public.validation_api_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'finance'::app_role) OR has_role(auth.uid(), 'purchase'::app_role));

-- Vendors can view own logs
CREATE POLICY "Vendors can view own validation logs" 
ON public.validation_api_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM vendors 
  WHERE vendors.id = validation_api_logs.vendor_id 
  AND vendors.user_id = auth.uid()
));

-- Insert service role policy for edge functions
CREATE POLICY "Service role can insert logs"
ON public.validation_api_logs
FOR INSERT
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_validation_configs_updated_at
BEFORE UPDATE ON public.validation_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default validation configurations
INSERT INTO public.validation_configs (validation_type, display_name, description, is_enabled, is_mandatory, execution_stage, matching_threshold, retry_count, timeout_seconds, schedule_frequency_days, priority_order) VALUES
('gst', 'GST Validation', 'Validates GSTIN against Government GSTN-authorized API', true, true, 'ON_SUBMIT', NULL, 3, 30, 30, 1),
('pan', 'PAN Validation', 'Validates PAN card details', true, true, 'ON_SUBMIT', NULL, 3, 30, NULL, 2),
('name_match', 'Name Matching', 'Validates vendor name against GST registered name using similarity score', true, true, 'ON_SUBMIT', 80, 3, 30, NULL, 3),
('bank', 'Bank Account Verification', 'Validates bank account via ₹1 penny-drop verification', true, true, 'ON_SUBMIT', 75, 3, 60, NULL, 4),
('msme', 'MSME/Udyam Verification', 'Validates MSME/Udyam registration number', true, false, 'ON_SUBMIT', NULL, 3, 30, NULL, 5);

-- Create scheduled_validations table for periodic checks
CREATE TABLE public.scheduled_validations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  validation_type TEXT NOT NULL,
  next_run_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_status TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_validations ENABLE ROW LEVEL SECURITY;

-- Admins can manage scheduled validations
CREATE POLICY "Admins can manage scheduled validations" 
ON public.scheduled_validations 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Finance can view scheduled validations
CREATE POLICY "Finance can view scheduled validations" 
ON public.scheduled_validations 
FOR SELECT 
USING (has_role(auth.uid(), 'finance'::app_role));