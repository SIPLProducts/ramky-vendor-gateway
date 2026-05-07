## Fix Approval Chain card to show canonical flow

In `src/components/admin/ApprovalMatrixConfig.tsx`, the Approval Chain card currently renders `savePlan` in the order rows happen to be created. Issue in screenshot: SCM Head is missing (no row configured) and Finance 1/2 appear before what should be SCM Head, so the chain reads incorrectly.

### Change

Render the chain by iterating `STAGE_ORDER` (`SCM_MANAGER → SCM_HEAD → FINANCE_1 → FINANCE_2 → CEO_OFFICE`) instead of raw `savePlan` order:

- For each stage, find matching groups in `savePlan`.
- If configured: show `L{n} · {Stage} · N approver(s)` badge (multiple badges for SCM Manager when several levels exist).
- If not configured: show a faded outline badge `"{Stage} · not configured"` so the gap is visible.
- Append `(MSME only)` note on CEO Office.
- Always render the card (even when nothing is saved) so users see the full intended pipeline.

No backend or other UI changes.

### Verification

Configure only SCM Manager + Finance 1 + Finance 2 + CEO Office (as in screenshot) → chain reads:
`Vendor Submitted → L1 SCM Manager (2) → SCM Head · not configured → L2 Finance 1 (1) → L3 Finance 2 (1) → L4 CEO Office (1) (MSME only) → SAP Sync`.
