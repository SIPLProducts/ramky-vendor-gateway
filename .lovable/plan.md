## Change

In `src/components/admin/ApprovalMatrixConfig.tsx` (lines 752 & 761), remove the ` (MSME only)` suffix appended to the CEO Office stage chip in the Approval Chain visualization.

- Replace `{isCeo ? ' (MSME only)' : ''}` with `''` (drop the conditional entirely) in both places.

No other logic, styling, or MSME-routing behavior changes — purely a label cleanup.