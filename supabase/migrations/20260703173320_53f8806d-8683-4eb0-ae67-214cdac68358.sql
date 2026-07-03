GRANT SELECT ON public.sap_master_data TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.sap_master_data TO authenticated;
GRANT ALL ON public.sap_master_data TO service_role;