## Changes

### 1. `src/pages/Dashboard.tsx`
- Remove the "Reference Number" input, Search button, `trackRef`/`isTracking` state, `handleTrackByReference`, and related imports (`Loader2`, `Search` if unused elsewhere, `useNavigate`, `useToast`, `Label` if unused).
- In the "Vendor Applications" `CardHeader`, add a search `Input` at the right end of the header row (alongside the existing "Showing: …" indicator).
- Add local `tableSearch` state. Filter `filteredVendors` further by case-insensitive substring match across the visible column values: Reference Number, Invited By (name), Vendor Name (`pickVendorDisplayName`), Vendor Email (`display_email`), Status label, and Created Date (formatted).
- Empty-state text stays; message adjusts when a search yields no rows.

### 2. `src/pages/VendorList.tsx`
- Add a "Reference Number" tracker in the top header area (next to Refresh/Export): small `Input` + "Search" button (with `Loader2` while loading). On submit, query `vendors` by `reference_number` and navigate to `/vendor-status/{id}`; show toast on not-found / error. Behaviour identical to the current Dashboard implementation.
- No change to existing search-in-table box or filters.

No routing, backend, or query-shape changes.
