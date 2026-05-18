
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS material_group_vendors text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vendor_categories       text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vendor_locations        text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS identification_sources  text[] NOT NULL DEFAULT '{}';

UPDATE public.vendors
SET material_group_vendors = ARRAY[material_group_vendor]
WHERE (material_group_vendors IS NULL OR array_length(material_group_vendors,1) IS NULL)
  AND material_group_vendor IS NOT NULL AND material_group_vendor <> '';

UPDATE public.vendors
SET vendor_categories = ARRAY[vendor_category]
WHERE (vendor_categories IS NULL OR array_length(vendor_categories,1) IS NULL)
  AND vendor_category IS NOT NULL AND vendor_category <> '';

UPDATE public.vendors
SET vendor_locations = ARRAY[vendor_location]
WHERE (vendor_locations IS NULL OR array_length(vendor_locations,1) IS NULL)
  AND vendor_location IS NOT NULL AND vendor_location <> '';

UPDATE public.vendors
SET identification_sources = ARRAY[identification_source]
WHERE (identification_sources IS NULL OR array_length(identification_sources,1) IS NULL)
  AND identification_source IS NOT NULL AND identification_source <> '';
