Update the approval action buttons so approve uses green text + green border and reject uses red text + matching red border, all via semantic design tokens.

1. Pending approval table buttons (`src/components/approvals/StageApprovalView.tsx`)
   - Reject button: change `variant="outline"` + `className="text-destructive"` to `variant="outline"` + `className="text-destructive border-destructive"` so the border matches the text color.
   - Approve button: change `variant="outline"` to `variant="outline"` + `className="text-success border-success"`.

2. Rejected tab Approve button
   - Apply the same `variant="outline"` + `className="text-success border-success"` styling.

3. Action confirmation dialog confirm buttons
   - Reject confirm: currently `variant={actionItem?.action === 'reject' ? 'destructive' : 'default'}`; change to `variant="outline"` + `className="text-destructive border-destructive"` for the reject path.
   - Approve confirm: change the approve path to `variant="outline"` + `className="text-success border-success"`.

4. Force-reject confirmation dialog
   - "Yes, reject anyway" button: change `variant="destructive"` to `variant="outline"` + `className="text-destructive border-destructive"` to keep the same text/border color rule.

5. Verify
   - Run `bunx tsgo --noEmit` to confirm no TypeScript errors.
   - Check the preview to confirm the green approve outline and red reject outline render correctly across pending and rejected tabs.