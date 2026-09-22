# Add Skip for CEO Office in Approval Matrix

## Goal
Allow administrators to skip the CEO Office stage exactly like SCM CO, SCM Head, Finance 1, and Finance 2, while preserving the existing rule that CEO Office applies only to MSME-registered domestic vendors.

## Changes
1. Add a `skip_ceo_office` setting to each buyer approval flow, defaulting to off so existing flows continue unchanged.
2. Add the **Skip** switch beside CEO Office in the Approval Matrix. When enabled:
   - disable the CEO Office approver selector;
   - show CEO Office as **Skipped** in the chain preview and configured-buyers table;
   - save and reload the choice with the rest of the flow.
3. Update approval-chain creation so no CEO Office approval row is created when the setting is enabled. When it is disabled, CEO Office remains conditional on the vendor being a domestic MSME vendor.
4. Update pending-approval lookup and invitation readiness checks to respect the new CEO Office skip setting, matching the safeguards used by the other stages.
5. Refresh generated database types after the schema change.

## Validation
- Configure CEO Office with an approver, turn **Skip** on, save, reopen, and confirm the setting persists and displays as skipped.
- Submit a domestic MSME vendor and confirm the chain bypasses CEO Office and advances to SAP Sync after the preceding stage.
- Turn **Skip** off and confirm a domestic MSME vendor receives the CEO Office stage.
- Confirm non-MSME and international vendors continue to omit CEO Office regardless of the switch.
- Verify existing approval flows retain their current behavior after deployment.

## Technical Details
- Add the new boolean column through a database migration with a non-null `false` default.
- Update the canonical approval-progress seeding function to require both `NOT skip_ceo_office` and the existing MSME eligibility condition.
- Extend the stage-to-skip mapping used by the pending approvals function.
