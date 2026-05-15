-- Cleanup duplicate vendor_documents: keep most recent per (vendor_id, document_type)
DELETE FROM public.vendor_documents vd
USING (
  SELECT id,
         row_number() OVER (PARTITION BY vendor_id, document_type ORDER BY uploaded_at DESC, id DESC) AS rn
  FROM public.vendor_documents
) ranked
WHERE vd.id = ranked.id AND ranked.rn > 1;

-- Prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS vendor_documents_vendor_type_unique
  ON public.vendor_documents (vendor_id, document_type);