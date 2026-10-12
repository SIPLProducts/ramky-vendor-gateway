# Compact dashboard application table

## Changes
- Remove **Vendor Email** from the dashboard table only. Keep email data, email search, and Excel export unchanged.
- Keep **Invited By**, **Vendor Name**, and responsible approver names on a single line with no wrapping.
- Keep responsible names beneath their Status badge, preserving existing assignment labels and all eligible SAP Team names.
- Reduce table cell padding, surrounding table spacing, and action-button gaps so more information fits on screen without making text too small.
- Keep dates and table headings on one line. Allow horizontal scrolling for unusually long names rather than hiding or overlapping them.

## Technical details
- Limit changes to dashboard presentation in `src/pages/Dashboard.tsx`; do not change registration saving, approval routing, permissions, or email functionality.
- Update loading placeholders and the empty-state column span from eight to seven columns.
- Apply dashboard-local spacing and `whitespace-nowrap` utilities rather than modifying shared table styling.

## Verification
- Check the populated dashboard at the user's approximately 1180px screen width and a wider desktop width.
- Confirm Vendor Email is absent, names remain on one line, and Status, Created Date, View, and Comments remain readable and accessible.
- Check long-name overflow, loading and empty states, search, and Excel export remain usable.
