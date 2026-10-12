# Compact dashboard application table

## Changes
- Remove **Vendor Email** from the dashboard table only. Keep email data, email search, and Excel export unchanged.
- Keep **Invited By**, **Vendor Name**, and responsible approver names on a single line with no wrapping.
- In the **Status** column, show the responsible person's name first in medium-weight text, with the role/status badge beneath it (for example, **Jeshan Ali** above **Buyer Review**). Keep all eligible SAP Team names on one line above their badge, and preserve missing-assignment labels.
- Use a small, consistent gap between name and role, existing theme colors, and restrained badge styling for a clean enterprise look. Where there is no responsible person, retain the status badge without adding a guessed name.
- Reduce table cell padding, surrounding table spacing, and action-button gaps so more information fits on screen without making text too small.
- Keep dates and table headings on one line. Allow horizontal scrolling for unusually long names rather than hiding or overlapping them.

## Technical details
- Limit changes to dashboard presentation in `src/pages/Dashboard.tsx`; do not change registration saving, approval routing, permissions, or email functionality.
- Update loading placeholders and the empty-state column span from eight to seven columns.
- Apply dashboard-local spacing and `whitespace-nowrap` utilities rather than modifying shared table styling.

## Verification
- Check the populated dashboard at the user's approximately 1180px screen width and a wider desktop width.
- Confirm Vendor Email is absent, names remain on one line, role/status badges appear below responsible names, and Created Date, View, and Comments remain readable and accessible.
- Check long-name overflow, loading and empty states, search, and Excel export remain usable.
