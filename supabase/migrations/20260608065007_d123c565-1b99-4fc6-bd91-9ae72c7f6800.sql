
-- 1. Buyer-scoped approval chain configuration
CREATE TABLE IF NOT EXISTS public.buyer_approval_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id uuid NOT NULL UNIQUE,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  scm_manager_user_id uuid,
  scm_head_user_id uuid,
  finance_1_user_id uuid,
  finance_2_user_id uuid,
  ceo_office_user_id uuid,
  skip_scm_manager boolean NOT NULL DEFAULT false,
  skip_scm_head boolean NOT NULL DEFAULT false,
  skip_finance_1 boolean NOT NULL DEFAULT false,
  skip_finance_2 boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.buyer_approval_flows TO authenticated;
GRANT ALL ON public.buyer_approval_flows TO service_role;

ALTER TABLE public.buyer_approval_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage buyer approval flows"
ON public.buyer_approval_flows FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_custom_role(auth.uid(), 'sharvi_admin')
  OR public.has_custom_role(auth.uid(), 'customer_admin')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_custom_role(auth.uid(), 'sharvi_admin')
  OR public.has_custom_role(auth.uid(), 'customer_admin')
);

CREATE POLICY "Users read flows that involve them"
ON public.buyer_approval_flows FOR SELECT TO authenticated
USING (
  buyer_user_id = auth.uid()
  OR scm_manager_user_id = auth.uid()
  OR scm_head_user_id = auth.uid()
  OR finance_1_user_id = auth.uid()
  OR finance_2_user_id = auth.uid()
  OR ceo_office_user_id = auth.uid()
);

CREATE TRIGGER trg_buyer_approval_flows_updated_at
BEFORE UPDATE ON public.buyer_approval_flows
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Per-stage timing on vendor_approval_progress
ALTER TABLE public.vendor_approval_progress
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Backfill existing rows: pending rows started when created; actioned rows completed when acted.
UPDATE public.vendor_approval_progress
SET started_at = COALESCE(started_at, created_at)
WHERE started_at IS NULL;

UPDATE public.vendor_approval_progress
SET completed_at = COALESCE(completed_at, acted_at)
WHERE completed_at IS NULL AND status IN ('approved','rejected','cancelled') AND acted_at IS NOT NULL;

-- 3. Replace seed_vendor_approval_progress with a buyer-flow-driven version.
CREATE OR REPLACE FUNCTION public.seed_vendor_approval_progress(_vendor_id uuid)
RETURNS TABLE(levels_created integer, vendor_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid;
  v_msme boolean;
  v_intl boolean;
  v_buyer uuid;
  v_on_behalf boolean := false;
  v_flow RECORD;
  v_count integer := 0;
  v_level integer := 0;
  v_first_stage text;
  v_first_status text;
BEGIN
  SELECT tenant_id,
         COALESCE(is_msme_registered, false),
         (COALESCE(vendor_type,'domestic') = 'international')
    INTO v_tenant, v_msme, v_intl
  FROM public.vendors WHERE id = _vendor_id;

  IF v_tenant IS NULL THEN
    RETURN QUERY SELECT 0, NULL::text; RETURN;
  END IF;

  IF v_intl THEN v_msme := false; END IF;

  SELECT vi.created_by, COALESCE(vi.created_on_behalf, false)
    INTO v_buyer, v_on_behalf
  FROM public.vendor_invitations vi
  WHERE vi.vendor_id = _vendor_id
  ORDER BY vi.created_at DESC
  LIMIT 1;

  DELETE FROM public.vendor_approval_progress WHERE vendor_id = _vendor_id;

  -- Buyer row (always present when we know who invited; auto-approved on-behalf)
  IF v_buyer IS NOT NULL THEN
    v_level := v_level + 1;
    IF v_on_behalf THEN
      INSERT INTO public.vendor_approval_progress
        (vendor_id, level_id, level_number, status, stage, acted_by, acted_at, comments, started_at, completed_at)
      VALUES
        (_vendor_id, NULL, v_level, 'approved', 'BUYER', v_buyer, now(),
         'Auto-approved: application submitted by buyer on behalf of vendor', now(), now());
    ELSE
      INSERT INTO public.vendor_approval_progress
        (vendor_id, level_id, level_number, status, stage, started_at)
      VALUES (_vendor_id, NULL, v_level, 'pending', 'BUYER', now());
    END IF;
    v_count := v_count + 1;
  END IF;

  -- Load buyer flow (may be NULL)
  IF v_buyer IS NOT NULL THEN
    SELECT * INTO v_flow FROM public.buyer_approval_flows WHERE buyer_user_id = v_buyer;
  END IF;

  -- Helper: insert a downstream stage row only if buyer flow has a user and not skipped.
  IF v_flow.id IS NOT NULL THEN
    IF v_flow.scm_manager_user_id IS NOT NULL AND NOT v_flow.skip_scm_manager THEN
      v_level := v_level + 1;
      INSERT INTO public.vendor_approval_progress (vendor_id, level_id, level_number, status, stage)
      VALUES (_vendor_id, NULL, v_level, 'pending', 'SCM_MANAGER');
      v_count := v_count + 1;
    END IF;
    IF v_flow.scm_head_user_id IS NOT NULL AND NOT v_flow.skip_scm_head THEN
      v_level := v_level + 1;
      INSERT INTO public.vendor_approval_progress (vendor_id, level_id, level_number, status, stage)
      VALUES (_vendor_id, NULL, v_level, 'pending', 'SCM_HEAD');
      v_count := v_count + 1;
    END IF;
    IF v_flow.finance_1_user_id IS NOT NULL AND NOT v_flow.skip_finance_1 THEN
      v_level := v_level + 1;
      INSERT INTO public.vendor_approval_progress (vendor_id, level_id, level_number, status, stage)
      VALUES (_vendor_id, NULL, v_level, 'pending', 'FINANCE_1');
      v_count := v_count + 1;
    END IF;
    IF v_flow.finance_2_user_id IS NOT NULL AND NOT v_flow.skip_finance_2 THEN
      v_level := v_level + 1;
      INSERT INTO public.vendor_approval_progress (vendor_id, level_id, level_number, status, stage)
      VALUES (_vendor_id, NULL, v_level, 'pending', 'FINANCE_2');
      v_count := v_count + 1;
    END IF;
    -- CEO Office only for MSME (and not international); never skippable.
    IF v_flow.ceo_office_user_id IS NOT NULL AND v_msme THEN
      v_level := v_level + 1;
      INSERT INTO public.vendor_approval_progress (vendor_id, level_id, level_number, status, stage)
      VALUES (_vendor_id, NULL, v_level, 'pending', 'CEO_OFFICE');
      v_count := v_count + 1;
    END IF;
  END IF;

  IF v_count = 0 THEN
    RETURN QUERY SELECT 0, NULL::text; RETURN;
  END IF;

  -- Determine first pending stage & stamp its started_at
  SELECT stage INTO v_first_stage
  FROM public.vendor_approval_progress
  WHERE vendor_id = _vendor_id AND status = 'pending'
  ORDER BY level_number ASC LIMIT 1;

  IF v_first_stage IS NOT NULL THEN
    UPDATE public.vendor_approval_progress
    SET started_at = COALESCE(started_at, now())
    WHERE vendor_id = _vendor_id
      AND status = 'pending'
      AND level_number = (
        SELECT MIN(level_number) FROM public.vendor_approval_progress
        WHERE vendor_id = _vendor_id AND status = 'pending'
      );
  END IF;

  v_first_status := CASE v_first_stage
    WHEN 'BUYER'       THEN 'buyer_review'
    WHEN 'SCM_MANAGER' THEN 'scm_manager_review'
    WHEN 'SCM_HEAD'    THEN 'scm_head_review'
    WHEN 'FINANCE_1'   THEN 'finance_1_review'
    WHEN 'FINANCE_2'   THEN 'finance_2_review'
    WHEN 'CEO_OFFICE'  THEN 'ceo_office_review'
    ELSE 'pending_sap_sync'
  END;

  UPDATE public.vendors SET status = v_first_status::vendor_status WHERE id = _vendor_id;

  RETURN QUERY SELECT v_count, v_first_status;
END;
$function$;
