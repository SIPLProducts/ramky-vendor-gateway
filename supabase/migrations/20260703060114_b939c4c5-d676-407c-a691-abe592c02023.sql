
CREATE TEMP TABLE _vendor_user_ids ON COMMIT DROP AS
SELECT DISTINCT user_id
FROM public.user_roles
WHERE role = 'vendor'::app_role;

INSERT INTO _vendor_user_ids (user_id)
SELECT DISTINCT vi.user_id
FROM public.vendor_invitations vi
WHERE vi.user_id IS NOT NULL
  AND vi.user_id NOT IN (SELECT user_id FROM _vendor_user_ids WHERE user_id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = vi.user_id AND ur.role <> 'vendor'::app_role
  );

INSERT INTO _vendor_user_ids (user_id)
SELECT DISTINCT v.user_id
FROM public.vendors v
WHERE v.user_id IS NOT NULL
  AND v.user_id NOT IN (SELECT user_id FROM _vendor_user_ids WHERE user_id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v.user_id AND ur.role <> 'vendor'::app_role
  );

-- Vendor-scoped data
DELETE FROM public.invitation_email_events;
DELETE FROM public.vendor_approval_progress;
DELETE FROM public.vendor_documents;
DELETE FROM public.vendor_validations;
DELETE FROM public.ocr_extractions;
DELETE FROM public.vendor_feedback;
DELETE FROM public.vendors;
DELETE FROM public.vendor_invitations;

-- Audit logs + login attempts for those users
DELETE FROM public.audit_logs    WHERE user_id IN (SELECT user_id FROM _vendor_user_ids);
DELETE FROM public.login_attempts
WHERE lower(email) IN (
  SELECT lower(email) FROM public.profiles WHERE id IN (SELECT user_id FROM _vendor_user_ids)
);

-- Vendor user rows
DELETE FROM public.user_custom_roles WHERE user_id IN (SELECT user_id FROM _vendor_user_ids);
DELETE FROM public.user_tenants      WHERE user_id IN (SELECT user_id FROM _vendor_user_ids);
DELETE FROM public.user_roles        WHERE user_id IN (SELECT user_id FROM _vendor_user_ids);
DELETE FROM public.profiles          WHERE id      IN (SELECT user_id FROM _vendor_user_ids);

DELETE FROM auth.users WHERE id IN (SELECT user_id FROM _vendor_user_ids);
