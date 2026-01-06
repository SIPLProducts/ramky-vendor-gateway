-- Vendor status enum
CREATE TYPE public.vendor_status AS ENUM (
  'draft',
  'submitted',
  'validation_pending',
  'validation_failed',
  'finance_review',
  'finance_approved',
  'finance_rejected',
  'purchase_review',
  'purchase_approved',
  'purchase_rejected',
  'sap_synced'
);

-- Validation status enum
CREATE TYPE public.validation_status AS ENUM ('pending', 'passed', 'failed', 'skipped');

-- Validation type enum  
CREATE TYPE public.validation_type AS ENUM ('gst', 'pan', 'bank', 'msme', 'name_match');

-- Vendor invitations table (for time-bound links)
CREATE TABLE public.vendor_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  vendor_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Main vendors table
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  invitation_id UUID REFERENCES public.vendor_invitations(id),
  status public.vendor_status NOT NULL DEFAULT 'draft',
  
  -- Organization Details
  legal_name TEXT,
  trade_name TEXT,
  registered_address TEXT,
  registered_city TEXT,
  registered_state TEXT,
  registered_pincode TEXT,
  communication_address TEXT,
  communication_city TEXT,
  communication_state TEXT,
  communication_pincode TEXT,
  same_as_registered BOOLEAN DEFAULT true,
  industry_type TEXT,
  product_categories TEXT[],
  
  -- Contact Details
  primary_contact_name TEXT,
  primary_designation TEXT,
  primary_email TEXT,
  primary_phone TEXT,
  secondary_contact_name TEXT,
  secondary_designation TEXT,
  secondary_email TEXT,
  secondary_phone TEXT,
  
  -- Statutory Details
  gstin TEXT,
  pan TEXT,
  msme_number TEXT,
  msme_category TEXT,
  entity_type TEXT,
  
  -- Bank Details
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  branch_name TEXT,
  account_type TEXT,
  
  -- Financial Details
  turnover_year1 NUMERIC,
  turnover_year2 NUMERIC,
  turnover_year3 NUMERIC,
  credit_period_expected INTEGER,
  
  -- Declaration
  self_declared BOOLEAN DEFAULT false,
  terms_accepted BOOLEAN DEFAULT false,
  
  -- Workflow timestamps
  submitted_at TIMESTAMP WITH TIME ZONE,
  finance_reviewed_by UUID REFERENCES auth.users(id),
  finance_reviewed_at TIMESTAMP WITH TIME ZONE,
  finance_comments TEXT,
  purchase_reviewed_by UUID REFERENCES auth.users(id),
  purchase_reviewed_at TIMESTAMP WITH TIME ZONE,
  purchase_comments TEXT,
  
  -- SAP Integration
  sap_vendor_code TEXT,
  sap_synced_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Vendor validations table
CREATE TABLE public.vendor_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  validation_type public.validation_type NOT NULL,
  status public.validation_status NOT NULL DEFAULT 'pending',
  message TEXT,
  details JSONB,
  validated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Vendor documents table
CREATE TABLE public.vendor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Portal configuration table
CREATE TABLE public.portal_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert default configurations
INSERT INTO public.portal_config (config_key, config_value, description) VALUES
  ('link_expiry_days', '14', 'Default number of days for vendor invitation link expiry'),
  ('name_match_threshold', '80', 'Minimum similarity score for vendor name matching (0-100)'),
  ('penny_drop_enabled', 'true', 'Enable ₹1 penny drop bank verification'),
  ('gst_verification_enabled', 'true', 'Enable GST verification'),
  ('pan_verification_enabled', 'true', 'Enable PAN verification'),
  ('msme_verification_enabled', 'true', 'Enable MSME/Udyam verification'),
  ('periodic_gst_check_days', '90', 'Days between periodic GST verification checks');

-- Enable RLS
ALTER TABLE public.vendor_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vendor_invitations
CREATE POLICY "Admins can manage invitations"
  ON public.vendor_invitations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Finance and Purchase can view invitations"
  ON public.vendor_invitations FOR SELECT
  USING (public.has_role(auth.uid(), 'finance') OR public.has_role(auth.uid(), 'purchase'));

-- RLS Policies for vendors
CREATE POLICY "Vendors can view own data"
  ON public.vendors FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Vendors can update own draft data"
  ON public.vendors FOR UPDATE
  USING (user_id = auth.uid() AND status = 'draft');

CREATE POLICY "Vendors can insert own data"
  ON public.vendors FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Finance can view all vendors"
  ON public.vendors FOR SELECT
  USING (public.has_role(auth.uid(), 'finance'));

CREATE POLICY "Finance can update vendors in review"
  ON public.vendors FOR UPDATE
  USING (public.has_role(auth.uid(), 'finance') AND status IN ('finance_review', 'validation_failed'));

CREATE POLICY "Purchase can view all vendors"
  ON public.vendors FOR SELECT
  USING (public.has_role(auth.uid(), 'purchase'));

CREATE POLICY "Purchase can update vendors in purchase review"
  ON public.vendors FOR UPDATE
  USING (public.has_role(auth.uid(), 'purchase') AND status = 'purchase_review');

CREATE POLICY "Admins can manage all vendors"
  ON public.vendors FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for vendor_validations
CREATE POLICY "Vendors can view own validations"
  ON public.vendor_validations FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = vendor_validations.vendor_id AND vendors.user_id = auth.uid()));

CREATE POLICY "Finance and Purchase can view all validations"
  ON public.vendor_validations FOR SELECT
  USING (public.has_role(auth.uid(), 'finance') OR public.has_role(auth.uid(), 'purchase'));

CREATE POLICY "Admins can manage validations"
  ON public.vendor_validations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for vendor_documents
CREATE POLICY "Vendors can manage own documents"
  ON public.vendor_documents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = vendor_documents.vendor_id AND vendors.user_id = auth.uid()));

CREATE POLICY "Finance and Purchase can view all documents"
  ON public.vendor_documents FOR SELECT
  USING (public.has_role(auth.uid(), 'finance') OR public.has_role(auth.uid(), 'purchase'));

CREATE POLICY "Admins can manage all documents"
  ON public.vendor_documents FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for audit_logs
CREATE POLICY "Users can view audit logs they created or about their vendors"
  ON public.audit_logs FOR SELECT
  USING (
    user_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.vendors WHERE vendors.id = audit_logs.vendor_id AND vendors.user_id = auth.uid())
  );

CREATE POLICY "Finance and Purchase can view all audit logs"
  ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'finance') OR public.has_role(auth.uid(), 'purchase'));

CREATE POLICY "Insert audit logs for authenticated users"
  ON public.audit_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage audit logs"
  ON public.audit_logs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for portal_config
CREATE POLICY "Everyone can view config"
  ON public.portal_config FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage config"
  ON public.portal_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at on vendors
CREATE TRIGGER update_vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_vendors_status ON public.vendors(status);
CREATE INDEX idx_vendors_user_id ON public.vendors(user_id);
CREATE INDEX idx_vendors_submitted_at ON public.vendors(submitted_at);
CREATE INDEX idx_vendor_validations_vendor_id ON public.vendor_validations(vendor_id);
CREATE INDEX idx_vendor_documents_vendor_id ON public.vendor_documents(vendor_id);
CREATE INDEX idx_audit_logs_vendor_id ON public.audit_logs(vendor_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX idx_vendor_invitations_token ON public.vendor_invitations(token);
CREATE INDEX idx_vendor_invitations_email ON public.vendor_invitations(email);