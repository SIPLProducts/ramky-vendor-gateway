## Goal

Replace the current `/dashboard` page with a simple, role-aware dashboard:

- 4 summary cards: Total / Pending / Approved / Rejected applications
- Date Range filter (applied to vendor `created_at`)
- Data table of vendors matching the filter
- Export to Excel button (exports the currently filtered rows)

Role-based visibility is already enforced by `useTenantFilter` + the RLS we tightened previously, so the dashboard just consumes those hooks — no new policies needed.

## Metric definitions

Counts are taken from the `vendors` rows the current user can see (RLS + `useTenantFilter`), filtered by the chosen date range on `created_at`:

- **Total Applications** — all visible vendors.
- **Pending Applications** — `status` in any pre-SAP-Sync stage: `draft`, `submitted`, `buyer_review`, `scm_manager_review`, `scm_head_review`, `finance_1_review`, `finance_2_review`, `ceo_office_review`, `pending_sap_sync`, `validation_pending`, `returned_to_vendor`.
- **Approved Applications** — `status = 'sap_synced'`.
- **Rejected Applications** — `status = 'sap_team_rejected'` (the SAP Sync Rejected tab).

## Visibility (already in place — confirm only)

- Admin / Sharvi admin / Customer admin / SAP Team → all vendors (within tenant filter).
- Buyer → only vendors from invitations they created (`buyer_visible_vendor_ids`).
- SCM Manager → only vendors of mapped buyers (`buyer_scm_mappings`).
- SCM Head / Finance 1 / Finance 2 / CEO Office → only vendors routed to them via `buyer_approval_flows` (`approver_visible_vendor_ids`).

No changes needed in RLS, helpers, or `useTenantContext`.

## Frontend changes

**`src/pages/Dashboard.tsx`** — rewrite to the simple layout:

1. Use `useAuth`, `useTenantContext`, and `useTenantFilter` to scope queries (same pattern as `VendorList`).
2. Local state: `dateFrom`, `dateTo` (default last 30 days). Use the shadcn Calendar in a Popover for each, with the `pointer-events-auto` fix.
3. Single React Query: `['dashboard-vendors', tenantFilter, dateFrom, dateTo]` →
   `from('vendors').select('id, reference_number, company_name, vendor_email, status, created_at, tenant_id')` with:
   - tenant filter from `useTenantFilter` (`tenantIds` or `vendorIds` as appropriate);
   - `.gte('created_at', dateFrom).lte('created_at', dateTo)`;
   - `.order('created_at', { ascending: false })`.
4. Compute the 4 counts in `useMemo` from the returned rows.
5. Render:
   - Header row with title + Date Range pickers + **Export to Excel** button.
   - 4 metric `Card`s (reuse existing icons: `FileText`, `Clock`, `CheckCircle`, `XCircle`).
   - `Table` with columns: Reference #, Company, Email, Status (badge), Created At. Row click → `/vendors/:id`.
   - Empty state and `Skeleton` loading state.
6. **Export to Excel** handler:
   - Uses `xlsx` (already common in this kind of app; add dependency if missing) to build a single sheet from current rows.
   - Filename: `vendors_<from>_to_<to>.xlsx`.
   - No server call — exports exactly what the user can see.

**Routing / nav** — no change; this replaces the existing `/dashboard` page.

## Out of scope

- No change to RLS, helpers, or other pages.
- No new tables, columns, or edge functions.
- Existing complex dashboard widgets (stuck approvals, buyer companies panel, realtime banners, etc.) are intentionally removed per "simple dashboard". If you want to keep any of those, tell me which.

## Verification

1. Log in as Buyer (Sriusha) → counts and table reflect only her vendors; Ajay Babu sees zero.
2. Log in as Finance 1 mapped to Sriusha → sees only vendors routed to Finance 1 for her flow.
3. Log in as Admin / SAP Team → sees all vendors (respecting active tenant).
4. Change date range → cards and table both update.
5. Export to Excel → file contains exactly the visible rows.

## Question before I build

Want me to **replace** the current Dashboard entirely, or add this as a **new page** (e.g. `/dashboard/summary`) and leave the existing one in place?
