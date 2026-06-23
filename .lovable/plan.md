## 1. Fix document View/Download for SAP Team role

**Root cause.** The storage RLS policy `"Vendor and approvers can view documents"` on `storage.objects` (migration `20260506070349`) only allows: the vendor themselves, `admin`, `sharvi_admin`, `customer_admin`, `finance`, `purchase`, `approver` app_roles. SAP Team is a **custom role** (checked via `public.is_sap_team()` / `public.has_custom_role()`), not an app_role — so `createSignedUrl` and `.download()` both get denied and the UI shows "Storage object not found". Same reason other cross-tenant reviewer custom roles (SCM Head, Finance 1/2, CEO Office) may hit it.

**Fix.** Add one new migration that drops and recreates the SELECT policy on `storage.objects` for the `vendor-documents` bucket, extending the allow-list to include SAP Team and the other reviewer custom roles via the existing security-definer helpers:

```sql
DROP POLICY IF EXISTS "Vendor and approvers can view documents" ON storage.objects;

CREATE POLICY "Vendor and approvers can view documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'vendor-documents'
    AND (
      EXISTS (
        SELECT 1 FROM public.vendors v
        WHERE v.id::text = (storage.foldername(name))[1]
          AND (v.user_id = auth.uid()
               OR lower(v.primary_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'sharvi_admin'::app_role)
      OR public.has_role(auth.uid(), 'customer_admin'::app_role)
      OR public.has_role(auth.uid(), 'finance'::app_role)
      OR public.has_role(auth.uid(), 'purchase'::app_role)
      OR public.has_role(auth.uid(), 'approver'::app_role)
      OR public.is_sap_team(auth.uid())
      OR public.is_cross_tenant_reviewer(auth.uid())
    )
  );
```

No client code changes needed — once the policy allows SAP Team, the existing View/Download buttons in **All Vendors** (`VendorList` → `VendorReviewDialog` → `VendorDocuments`) and **SAP Sync** (`SAPSync` → same dialog) will work.

## 2. NAME1 fallback rule update

Current rule in `src/lib/sapPayloadBuilder.ts` `getSapName1()`:
- GST present → `trade_name || legal_name` ✓ (already correct)
- GST absent → `legal_name || account_holder_name || trade_name` ✗

New rule per user:
- GST present → `trade_name || legal_name` (unchanged)
- GST absent → `account_holder_name || legal_name || trade_name`

**Change.** Single edit in `src/lib/sapPayloadBuilder.ts` line 40 — swap the order so `account_holder_name` comes before `legal_name`. Update the doc-comment above the function to match.

Because every table/dialog already routes through `getSapName1()` (per prior work), this one-line change propagates everywhere automatically.

**Also align two inline duplicates** that don't call `getSapName1()`:
- `src/hooks/useRealtimeUpdates.tsx` — `pickVendorName()` helper: apply the same `account_holder_name`-first ordering for the no-GST branch.
- `src/pages/AuditLogs.tsx` — the inline `gstin ? trade_name : legal_name` expression: change the no-GST branch to prefer `account_holder_name` then `legal_name`.

## Out of scope
- No changes to upload paths, the bucket itself, or other storage policies (INSERT/UPDATE/DELETE).
- No schema changes, no edge-function changes.
- No UI/layout changes beyond what the display rule produces.

## Verification
- Sign in as a SAP Team user → All Vendors → open a vendor → click View and Download on each document → file opens / downloads (no "Storage object not found" toast).
- Same on SAP Sync screen.
- A vendor with GST + no trade name shows Legal Name in every table.
- A vendor without GST shows Account Holder Name in every table; falls back to Legal Name only if account holder name is empty.