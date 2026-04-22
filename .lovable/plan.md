

## Fix vendor data visibility — remove the hidden tenant filter trap

### Root cause

The vendor data is in the database, but the app is filtering it to the wrong buyer company:

- Current dashboard requests are going out with `tenant_id = REEL`
- The database currently has **15 vendors**, all under **RIL**
- Because of that mismatch, the UI shows empty vendor states even though data exists

This is not a database-loss issue. It is a **UI filter/state issue**.

### Why this is happening

The app stores the selected tenant in local storage via `lovable.activeTenantId`, and vendor queries use that value through `useTenantFilter()`.

Right now:
- `useVendors()` and `useVendorStats()` respect the active tenant filter
- the layout on `/dashboard` does **not** render the tenant switcher
- so the user gets stuck on a previously selected tenant and cannot see or change the filter

### Fix to implement

#### 1) Make tenant selection visible in the main app layout
Add the tenant switcher to the portal layout so admin users can always see which buyer company is active.

Implementation:
- Integrate `EnterpriseHeader` into `src/components/layout/AppLayout.tsx`
- Show it for desktop portal users above the page content
- Keep mobile header behavior aligned so tenant context is still accessible on smaller screens

Result:
- User can immediately see whether the app is filtered to REEL, RIL, or All Tenants
- Empty vendor pages are no longer confusing

#### 2) Default super admins/admins to “All Tenants”
Update tenant context so admin-level users do not get stuck on a stale tenant from an earlier session.

Implementation in `src/hooks/useTenantContext.tsx`:
- For `sharvi_admin` and `admin`, default `activeTenantId` to `null` (All Tenants)
- Keep validation for invalid stored tenant ids
- Only preserve an explicit tenant choice when the switcher is visible and usable

Result:
- Dashboard and Vendor List open with full data by default for admin users
- Tenant-specific work can still be done by selecting a tenant intentionally

#### 3) Show the active filter in empty states
Improve empty states on vendor-facing admin screens so users know when data is hidden by a tenant filter.

Implementation:
- Update `src/pages/Dashboard.tsx`
- Update `src/pages/VendorList.tsx`
- If vendor count is 0 and a tenant is selected, show a message like:
  - “No vendors found for Ramky Energy & Environment”
  - with a quick hint to switch tenant / view all tenants

Result:
- Users understand whether there is truly no data or just no data for the selected company

#### 4) Keep existing data queries intact
No change to database schema or RLS is needed.

Reason:
- Network requests are returning `200` with empty arrays, which means access is working
- The problem is the filter value, not permissions

### Files to update

- `src/hooks/useTenantContext.tsx`
  - adjust admin default tenant behavior
  - prevent stale hidden filtering from controlling the app

- `src/components/layout/AppLayout.tsx`
  - render the tenant switcher/header in protected portal pages

- `src/components/layout/MobileHeader.tsx`
  - expose tenant context on mobile if needed for consistency

- `src/pages/Dashboard.tsx`
  - add clearer tenant-aware empty messaging

- `src/pages/VendorList.tsx`
  - add clearer tenant-aware empty messaging

### Technical notes

```text
Current flow:
localStorage(lovable.activeTenantId)
  -> useTenantContext()
  -> useTenantFilter()
  -> useVendors()/useVendorStats()
  -> requests include tenant_id=eq.<selected tenant>
  -> empty UI if selected tenant has no vendors
```

```text
Desired flow:
Admin opens app
  -> default = All Tenants
  -> visible tenant selector in layout
  -> user can intentionally switch to REEL / RIL / REE / etc.
  -> vendor lists and dashboard always match visible filter state
```

### Acceptance checks

1. Log in as admin / sharvi admin
2. Open Dashboard
3. Tenant selector is visible
4. Default view shows all vendors instead of a hidden stale tenant
5. Switch to `Ramky Infrastructure Limited` and see the 15 vendor records
6. Switch to a tenant with no vendors and see a clear tenant-specific empty state
7. Open Vendor List and confirm the same behavior there

### Out of scope

- No database migration
- No RLS policy change
- No vendor data backfill
- No change to approval-matrix storage logic

