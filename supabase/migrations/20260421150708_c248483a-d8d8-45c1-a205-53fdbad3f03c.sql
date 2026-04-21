-- Create ocr_extractions table to store OCR results for audit
CREATE TABLE public.ocr_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE CASCADE,
  user_id UUID,
  document_type TEXT NOT NULL,
  extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC,
  raw_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ocr_extractions_vendor ON public.ocr_extractions(vendor_id);
CREATE INDEX idx_ocr_extractions_user ON public.ocr_extractions(user_id);

ALTER TABLE public.ocr_extractions ENABLE ROW LEVEL SECURITY;

-- Vendors can view their own extractions
CREATE POLICY "Vendors view own ocr extractions"
ON public.ocr_extractions FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM vendors v WHERE v.id = ocr_extractions.vendor_id AND v.user_id = auth.uid())
);

-- Vendors can insert their own extractions
CREATE POLICY "Vendors insert own ocr extractions"
ON public.ocr_extractions FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM vendors v WHERE v.id = ocr_extractions.vendor_id AND v.user_id = auth.uid())
);

-- Admins can view all
CREATE POLICY "Admins view all ocr extractions"
ON public.ocr_extractions FOR SELECT
USING (
  has_role(auth.uid(), 'sharvi_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'finance'::app_role)
  OR has_role(auth.uid(), 'purchase'::app_role)
);

-- Service role / edge functions can insert
CREATE POLICY "Service role can insert ocr extractions"
ON public.ocr_extractions FOR INSERT
WITH CHECK (true);