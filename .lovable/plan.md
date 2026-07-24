Exclude Draft applications from Dashboard totals and the table.

Changes in `src/pages/Dashboard.tsx`:
- Compute `total` as `vendors.length` minus draft-status vendors (using existing `DRAFT_STATUSES`).
- Filter out draft vendors in `statusFilteredVendors` for the `all` case so the underlying table matches the tile count.
- Pending/Approved/Rejected counts already exclude drafts — no change there.