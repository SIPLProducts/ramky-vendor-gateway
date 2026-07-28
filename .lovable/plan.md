## Problem

When a Buyer re-approves after a rejection (e.g. from SCM Manager), the comment saved to the approval history is auto-generated:

`Approved after rejection by SCM_MANAGER — Verifyed and approved`

The buyer wants only their own comment (`Verifyed and approved`) to appear — no auto-prefix, no stage name.

## Root cause

`supabase/functions/buyer-reapprove-rejected/index.ts` (line 113) constructs a synthetic string before saving the BUYER approval row:

```ts
const buyerComment = `Approved after rejection${fromStage ? ` by ${fromStage}` : ''}${comments ? ` — ${comments}` : ''}`;
```

That prefix is what's showing in the comments history.

## Fix

In `supabase/functions/buyer-reapprove-rejected/index.ts`:

- Remove the `buyerComment` template.
- Save the buyer's raw `comments` value directly into `vendor_approval_progress.comments` (empty string / null if not provided — matching the normal approve flow in `process-approval-action`).

No UI changes; no other flows touched. Rejection metadata clearing and chain re-seeding stay as-is.

## Result

Comments history for a buyer re-approval will show exactly what the buyer typed, e.g. `Verifyed and approved`, with no `Approved after rejection by SCM_MANAGER — ` prefix.