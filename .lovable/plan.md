# Dashboard Status: person above role

## Change
- Show the responsible person's name on top and the existing role/status badge underneath in the Dashboard **Status** column.
- Apply this order wherever responsible names are displayed, including Buyer, SCM CO, SCM Head, Finance 1, Finance 2, CEO Office, and SAP Team.
- Keep names on one line, compact spacing, existing colors, and current missing-assignment labels. Statuses without a responsible-name line retain only their badge.

## Technical details
- Reorder the two existing elements in `src/pages/Dashboard.tsx`; do not change name lookups, approval routing, permissions, or other columns.

## Verification
- Check a populated dashboard to confirm the name appears above the badge and long names remain readable without overlapping adjacent columns.