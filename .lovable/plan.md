## Change

In `src/components/admin/BuyerScmMapping.tsx`, remove the "Skip Buyer Approval" column from the Existing Mappings table so the buyer stage is always part of the flow.

### Edits (UI-only)
1. Remove the `<TableHead className="w-56">Skip Buyer Approval</TableHead>` header cell.
2. Remove the corresponding `<TableCell>` (the Switch bound to `skip_buyer_stage` + `handleToggleSkipBuyer`).
3. Remove the now-unused `handleToggleSkipBuyer` function.
4. Remove `skip_buyer_stage` from the `MappingRow` interface (UI typing only).

### Not changed
- Database column `skip_buyer_stage` and any backend routing logic remain intact (no migrations, no edge function edits) — only the admin toggle is hidden, preserving existing functionality. New mappings will default to buyer-approves-first behavior since the toggle is no longer set from the UI.
- "Include SCM in flow" toggle remains unchanged.
