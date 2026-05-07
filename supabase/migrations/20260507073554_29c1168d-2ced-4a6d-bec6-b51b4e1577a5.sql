
UPDATE public.vendor_approval_progress vap
SET level_number = CASE aml.stage
  WHEN 'SCM_MANAGER' THEN 1
  WHEN 'SCM_HEAD' THEN 2
  WHEN 'FINANCE_1' THEN 3
  WHEN 'FINANCE_2' THEN 4
  WHEN 'CEO_OFFICE' THEN 5
  ELSE vap.level_number
END
FROM public.approval_matrix_levels aml
WHERE aml.id = vap.level_id
  AND vap.vendor_id IN (
    '6d652397-9400-4efb-9045-d57fae133518'::uuid,
    'a0a0b224-d741-4911-8b89-ee36e5e0003b'::uuid
  );
