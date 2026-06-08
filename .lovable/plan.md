## Goal
Update the Approval Matrix "Configured Buyers" table to remove the Company column and add a delete action with SweetAlert confirmation.

## Changes

### 1. UI Table — `src/components/admin/ApprovalMatrixConfig.tsx`
- **Remove** the `Company` column from the table header and all table rows.
- **Add** a `Delete` action button (icon) in each row's rightmost cell.
- **Delete flow:** On click, show a SweetAlert2 (`swal`) confirmation with the message "Are you sure want to delete?" and **Yes / No** buttons.
  - **Yes** → delete the row from `buyer_approval_flows` via Supabase, then refresh the table.
  - **No** → close the dialog with no action.
- Prevent the row click handler from triggering when the delete button is clicked.

### 2. Dependency
- Install `sweetalert2` (not currently in the project).

## Out of Scope
- No backend / edge function changes.
- No changes to the save flow or approval logic.
- No changes to other tabs or components.
