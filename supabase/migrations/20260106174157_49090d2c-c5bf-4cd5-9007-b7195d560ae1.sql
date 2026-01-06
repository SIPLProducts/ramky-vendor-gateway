-- Create storage bucket for vendor documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-documents',
  'vendor-documents',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
);

-- Storage policies for vendor documents
CREATE POLICY "Vendors can upload own documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'vendor-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Vendors can view own documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vendor-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Vendors can update own documents"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'vendor-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Vendors can delete own documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'vendor-documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Finance and Purchase can view all vendor documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vendor-documents' AND 
    (public.has_role(auth.uid(), 'finance') OR public.has_role(auth.uid(), 'purchase') OR public.has_role(auth.uid(), 'admin'))
  );