## Changes in `src/pages/Dashboard.tsx`

1. **Pending count fix** — Add `'dms_sync_pending'` to `PENDING_STATUSES` so vendors in that state are counted under Pending Applications and appear when the Pending card is selected.

2. **Show only submitted vendors** — Add `.neq('status', 'draft')` to the vendors query so Draft (not-yet-submitted) records are excluded for every role. Only submitted vendors appear in the table, the four count cards, and the Excel export.

No other files change.
