# User Audit Report: No-Wrap Table Text

## Change
- All table headers and cells stay on a single line, with no wrapping.
- Every column shows its full value: vendor name, GSTIN, company, comments and status badges are not cut off.
- Columns size themselves to their content. If the table is wider than the screen, a horizontal scrollbar appears inside the table only. The page itself does not scroll sideways.
- Action Date shows date and time on one line, e.g. "28-07-2026 16:41".
- The Action and View columns stay pinned (sticky) on the left and right while scrolling sideways, so you always see what the row is and can open it.
- Font stays small (11px) and row height stays compact.

## Technical details
- `src/pages/UserAuditReport.tsx` only.
- Remove `table-fixed` and the percentage widths. Wrap the table in `overflow-x-auto`.
- `TH`/`TD` get `whitespace-nowrap`. Replace the `whitespace-normal break-words` inserted in the combined table with `whitespace-nowrap`. Badges also get `whitespace-nowrap`.
- Sticky: the first two columns get `sticky left-0` with a background; the View column gets `sticky right-0 bg-card`.
