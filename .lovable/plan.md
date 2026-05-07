# Fix: Submitted vendor not reaching SCM Manager Approval

## Root cause

When a vendor submits the registration, `useVendorRegistration` calls the `route-vendor-approval` edge function, which is what creates the `vendor_approval_progress` rows that drive every approval inbox (SCM Manager, SCM Head, Finance 1/2, CEO Office).

That edge function currently requires one of these roles:
`['admin', 'sharvi_admin', 'customer_admin', 'finance', 'purchase']`

But the user submitting the form has role `vendor` (confirmed from DB for the latest stuck submission `e159c529…`, submitted 2026-05-07). The call returns **403 Forbidden**, the catch block swallows it as "non-blocking", and **no progress rows are created** — so the vendor never appears in any approver's inbox even though `vendors.status = purchase_review`.

Confirmed in DB:
- Vendor `e159c529…` (status=`purchase_review`, submitted today) → `vendor_approval_progress` rows = **0**
- Older vendor `6d652397…` → has 2 progress rows (SCM_HEAD L1, SCM_MANAGER L2, both `pending`) and DOES show in the screenshot

## Secondary issue: incomplete approval matrix

For tenant `Ramky Infrastructure Limited` only **2 levels** are configured:
- L1 · SCM Head (brijesh.kabra@ramky.com)
- L2 · SCM Manager (soumendukumar.sengupta@ramky.com)

There are **no levels for FINANCE_1, FINANCE_2, or CEO_OFFICE**, so even after SCM approvals the workflow you described (Finance 1 → Finance 2 → CEO Office for MSME → SAP Sync) cannot run. Those must be added in **User Management → Approval Matrix**.

## Plan

### 1. Fix `route-vendor-approval` authorization
File: `supabase/functions/route-vendor-approval/index.ts`

Add `'vendor'` to the `allowedRoles` list in `requireAuthenticatedUser(...)`, since a vendor legitimately calls this function once for their own submission. (The function already validates `vendor_id` and uses the service role to write progress, so widening the role allowlist is safe — it only seeds the matrix; it doesn't grant approval ability.)

### 2. Surface failures instead of swallowing them
File: `src/hooks/useVendorRegistration.tsx` (around line 622)

- Capture the `error` returned by `supabase.functions.invoke('route-vendor-approval', …)` and show a destructive toast when it fails (currently only the success message is inspected; HTTP 403/500 errors fall into the silent `catch` only when the SDK throws).
- Log the response body so this kind of regression is visible in the browser console next time.

### 3. Backfill the stuck vendor
After deploy, re-invoke `route-vendor-approval` for vendor `e159c529-3753-4c9c-9e17-534c7975a15d` (one-shot via Supabase RPC/edge invocation in the migration / via a small script) so it appears in the SCM Manager inbox without the vendor having to resubmit.

### 4. Tell the user about the missing matrix levels
Not a code change — confirm in the response that to get the full chain (SCM Manager → SCM Head → Finance 1 → Finance 2 → CEO Office for MSME → SAP Sync), an admin must add FINANCE_1, FINANCE_2, and CEO_OFFICE levels (with `requires_msme = true` on CEO_OFFICE) in **User Management → Approval Matrix** for the Ramky tenant. The routing function already filters CEO_OFFICE out for non-MSME vendors, so the MSME-Yes/No branching will work automatically once the levels exist.

## Out of scope
- Changing the approval matrix data itself (admin task in UI).
- Changes to SAP Sync screen (it already reads vendors with `status = approved` after Finance 2 / CEO Office completes — will work once the chain runs).
