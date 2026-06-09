# Replace Approval Stage column with Vendor Status lookup

## Changes

### 1. `src/pages/AdminInvitations.tsx`
- Remove the **Approval Stage** column (header + `VendorStageCell` cell). Keep the **Reference #** column.
- Remove the `STAGE_FILTER_OPTIONS` entries from the status filter (revert to invitation-lifecycle filters only).
- Add a **Track Vendor Status** search box beside the grid header (next to "Create Vendor" / "New Invitation", or above the table on the right):
  - Input placeholder: `Enter Reference Number`
  - **Search** button (icon + label)
  - On submit/click: trim input, look up the vendor by `reference_number` via `supabase.from('vendors').select('id').eq('reference_number', ref).maybeSingle()`. If found, `navigate('/vendor-status/' + id)`. If not found or RLS blocks it, show a toast: "No vendor found with this reference number".
  - Press Enter inside the input triggers Search.

### 2. New page `src/pages/VendorStatus.tsx`
Read-only status view for a single vendor.
- Route: `/vendor-status/:id` registered in `src/App.tsx` inside the existing protected `AppLayout` section.
- Header row: **Back to Vendor Invitations** button (`navigate('/admin/invitations')`) on the left, page title "Vendor Status" on the right.
- Fetch the vendor via `supabase.from('vendors').select('id, reference_number, company_name, vendor_email, vendor_type, status, created_at, last_rejection_comments').eq('id', id).maybeSingle()`. RLS already restricts visibility — if no row, show "Vendor not found or you do not have access".
- Content:
  - Summary card: Reference #, Company Name, Email, Vendor Type, Submitted On, current status badge (reuse the `getStatusBadge` helper pattern from `VendorList.tsx`, or inline a small map).
  - `RegistrationStatusTracker` (already used in `SuccessScreen`) wired with `useVendorApprovalChain(id)` to show the live stage pipeline.
  - `ApprovalTimeline` component (already exists at `src/components/vendor/ApprovalTimeline.tsx`) to show per-level history and comments.
- No edit actions — display only.

### 3. `src/App.tsx`
- Import `VendorStatus` and add `<Route path="/vendor-status/:id" element={<VendorStatus />} />` inside the same protected layout block where `/vendors` lives.

## Out of scope
- The `VendorStageCell.tsx` file stays on disk (no longer imported). No DB / RLS / edge-function changes.
- No change to `Dashboard.tsx` or other pages.

## Files touched
- `src/pages/AdminInvitations.tsx` — remove column + filter entries, add search box
- `src/pages/VendorStatus.tsx` — new page
- `src/App.tsx` — register route
