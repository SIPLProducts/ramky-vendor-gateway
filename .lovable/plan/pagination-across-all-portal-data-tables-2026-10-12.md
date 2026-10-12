# Pagination across all portal data tables

## What will change
- Add consistent pagination beneath every record-list data table across the portal, including Dashboard, users, invitations, vendors, approval queues, reports, logs, scheduled checks, and administration/master-data lists.
- Use **10 rows per page** by default, with **10, 20, 30, or 50** rows selectable, matching the existing page controls.
- Show the visible row range, total results, page numbers, and first/previous/next/last controls. Disable controls when unavailable and make their labels accessible.
- Give separate tables and tabs independent page state. Return to page 1 when search, filters, company selection, date range, or page size changes; keep the page valid after records are removed or refreshed.
- Search and filter the entire loaded result set before pagination. Keep summary counts and Excel/PDF exports based on all matching records, not only the visible page.
- Preserve selected records across page changes. Ensure any select-all control clearly distinguishes the current page from all matching records before bulk actions.
- Keep compact spacing and allow controls to wrap without overlapping table content.

## Scope
- Include growing record lists displayed as cards as well as rows, such as SAP/DMS queues, so page controls work consistently across those screens.
- Include administration lists even when they currently contain few records.
- Do not paginate a single record's field/value details, fixed comparison tables, permission matrices, or editable form rows; these are not record-list data tables.
- Keep permissions, approval routing, registration saving, SAP/DMS behavior, and document downloads unchanged.

## Technical details
- Reuse and strengthen `src/components/ui/data-table-pagination.tsx`, with shared state/slicing logic rather than adding pagination implicitly to the low-level table component.
- Preserve and standardize existing pagination in Vendor List, Audit Logs, Invitations, and GST Compliance rather than adding duplicate controls.
- Complete a table-by-table inventory before implementation, covering Dashboard and all administration components as well as the inspected user, report, SAP, and log screens.
- Apply pagination at each list's data boundary, keeping loading and empty-state rows outside record counts.
- Preserve current fetching behavior for this presentation change. Check existing fetch caps and do not describe loaded-result totals as database-wide totals where a query is capped; any broader fetching change is separate work.
- Record coverage and verification in the roadmap so no record-list table is silently omitted.

## Verification
- Test page boundaries, empty results, page-size changes, filter resets, and page clamping after deletion with focused logic tests.
- Exercise populated tables: navigate forward/back, change rows per page, search from a later page, and confirm the correct rows and counts.
- Check independent tabs, cross-page selections, row actions, and full-result exports.
- Check all record-list tables against the inventory and confirm there are no duplicate controls or app build errors.
- If the available account cannot access a screen, report its verification blocker without widening permissions.