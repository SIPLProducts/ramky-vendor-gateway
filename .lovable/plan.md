## Goal

1. The **Approved Applications** card on the Dashboard must count every SAP-synced vendor and exactly match the rows shown in the table.
2. Clicking any of the four stat cards (Total / Pending / Approved / Rejected) filters the table to that group; clicking the active card clears the filter.

## Changes — `src/pages/Dashboard.tsx`

### 1. Approved count matches "SAP synced" rows

After SAP sync, a vendor's status flips to `sap_synced` and then to `dms_synced` once documents post to DMS. The current Approved counter only counts `sap_synced`, so any vendor that moved on to `dms_synced` is missed and the table contains rows the card does not. Plus `dms_synced` is not in `STATUS_LABELS` so the table shows the raw enum string.

- Add `dms_synced: { label: 'Approved (DMS Synced)', variant: 'default' }` to `STATUS_LABELS`.
- Define `APPROVED_STATUSES = new Set(['sap_synced', 'dms_synced'])` and `REJECTED_STATUSES = new Set(['sap_team_rejected', 'sap_team_closed'])`.
- Update the `counts` memo to use those sets — guarantees card values == row counts per group.

### 2. Click-to-filter cards

- Add `const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')`.
- Derive `filteredVendors` with `useMemo`:
  - `all` → all vendors
  - `pending` → `PENDING_STATUSES.has(v.status)`
  - `approved` → `APPROVED_STATUSES.has(v.status)`
  - `rejected` → `REJECTED_STATUSES.has(v.status)`
- Bind each card to a key (`total | pending | approved | rejected`). Wrap each `Card` in a `button` (or add `role="button"`, `onClick`, `tabIndex=0`, keyboard handler) that toggles: clicking the active filter resets to `all`.
- Active card gets a ring/border (`ring-2 ring-primary` and `cursor-pointer`) for affordance.
- Table body, empty-state copy, and the Excel export all consume `filteredVendors` instead of `vendors`, so the export respects the active filter too.
- Show a small "Showing: <label>" hint with a "Clear filter" link above the table when `statusFilter !== 'all'`.

## Out of scope

- No backend / RLS / status-enum changes.
- No new columns or schema work.
- Date range, tenant scoping, and invited-by lookup stay unchanged — the new filter is applied on top of the already-fetched list.
