Remove the helper sentence shown beneath the "Approvers by Stage" table.

### Change
- **`src/components/admin/ApprovalMatrixConfig.tsx`** (line 611) — Remove the helper text "Add multiple levels and multiple approvers per level. SCM Manager levels are labelled SCM CO1, SCM CO2, SCM CO3…; other stages use L1, L2, L3…. Lower level acts first within this stage." The surrounding container and the "+ Add Level" / "+ Add Approver" buttons remain unchanged.

### Out of scope
No logic, workflow, routing, or other UI changes.