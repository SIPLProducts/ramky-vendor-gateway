## Simplify the All Vendors status dropdown

Replace the current 18-option dropdown with the compact list you asked for, and update the filter logic so each option matches all underlying database statuses that belong to it.

### New dropdown options and what each one filters

| Dropdown option | Matches these DB statuses |
|---|---|
| All Statuses | (no filter) |
| Draft | `draft` |
| Buyer Review | `submitted`, `validation_pending`, `validation_failed`, `buyer_review`, `returned_to_buyer` |
| SCM CO | `scm_manager_review`, `scm_manager_rejected` |
| SCM Head | `scm_head_review`, `scm_head_rejected` |
| Finance 1 | `finance_1_review`, `finance_1_rejected` |
| Finance 2 | `finance_2_review`, `finance_2_rejected` |
| CEO Office | `ceo_office_review`, `ceo_office_rejected` |
| SAP Team | `pending_sap_sync` |
| SAP Sync Pending | `pending_sap_sync` |
| DMS Pending | `sap_synced` (SAP done, DMS not yet complete) |
| SAP Synced | `sap_synced`, `dms_synced` |
| Duplicate & Closed | `sap_team_rejected`, `sap_team_closed` |
| Returned to Vendor | `returned_to_vendor` |

Note: “SAP Team” and “SAP Sync Pending” currently point at the same underlying status (`pending_sap_sync`). If you want them to behave differently, we need to know which DB status represents each — otherwise they will show identical results.

### Changes in `src/pages/VendorList.tsx`

1. Define a `STATUS_FILTER_GROUPS` map at the top of the file mapping each dropdown value (e.g. `'buyer_review'`, `'scm_co'`, `'duplicate_closed'`) to the array of DB statuses above.
2. Replace the current `<SelectItem>` list (lines 345–364) with the 13 options in the table.
3. Update the filter logic (line 164) from:
   ```ts
   const matchesStatus = statusFilter === 'all' || vendor.status === statusFilter;
   ```
   to look up the group and check `.includes(vendor.status)`.
4. Keep `getStatusBadge` (lines 202–236) unchanged so the table badge still shows the precise underlying state (e.g. "SCM CO Rejected" vs "SCM CO Review"), while the filter groups them together.

Frontend-only change in one file. No database or backend changes.
