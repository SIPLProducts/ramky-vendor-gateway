## Plan: Rename "View" action buttons to "View Details"

### Goal
Across the entire application, update every action button whose visible label is currently "View" to instead read "View Details". Non-button text, dialog titles, tab labels, and existing labels such as "View All Tenants", "View raw response", or "View details" are out of scope.

### Affected locations found
| # | File | Line(s) | Current label |
|---|------|---------|---------------|
| 1 | `src/components/approvals/StageApprovalView.tsx` | 252, 346 | `<Eye ... /> View` |
| 2 | `src/pages/Reports.tsx` | 348 | `<Eye ... /> View` |
| 3 | `src/pages/SAPSync.tsx` | 516, 726 | `<Eye ... />View` |
| 4 | `src/components/vendor/PersistedFileActions.tsx` | 88 | `View` |

### Implementation
For each location, change only the visible button text from `View` to `View Details`. No icons, handlers, or layout change.

Example transformations:
- `<Eye className="h-4 w-4 mr-1" /> View` → `<Eye className="h-4 w-4 mr-1" /> View Details`
- `<Eye className="h-4 w-4 mr-2" />View` → `<Eye className="h-4 w-4 mr-2" />View Details`
- Standalone `View` text inside `PersistedFileActions` button → `View Details`

### Verification
1. Run a source search to confirm no remaining visible action buttons contain exactly `" View"` or `">View<"`.
2. Run the TypeScript typecheck / build to ensure no JSX breakage.
3. No functional tests needed; this is a label-only change.

### Out of scope
- Navigation or tab labels (e.g., "View All Tenants", "View raw response").
- Existing "View details" label in `OcrUploadAndVerify`.
- Any icon-only buttons with `aria-label="View"` (none found).
- Backend, routes, or logic changes.