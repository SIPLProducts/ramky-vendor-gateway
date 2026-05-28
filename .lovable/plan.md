## Problem

After submitting the vendor registration form, the success screen shows "Finance Review in Progress" with the Finance 1 stage active. After a manual reload it correctly shows "Application Submitted Successfully" with the SCM Manager Approval stage active. The post-submit UI does not match the actual saved state.

## Root cause

In `src/pages/VendorRegistration.tsx`, `handleSubmissionDialogClose` hardcodes the status after closing the success dialog:

```ts
setVendorStatusState('finance_review');
```

However, `submitVendorMutation` in `src/hooks/useVendorRegistration.tsx` actually writes `status: 'scm_manager_review'` to the database (line 785). On reload, `vendorStatusState` is repopulated from the DB and renders correctly — hence the discrepancy between the two screenshots.

## Fix

1. In `src/pages/VendorRegistration.tsx` `handleSubmit`, capture the real status returned from `submitVendor` / `resubmitVendor` (the mutation returns the updated vendor row) and stash it alongside the existing `pendingPostSubmit` flag (e.g. add a `pendingStatus` state).
2. In `handleSubmissionDialogClose`, call `setVendorStatusState(pendingStatus ?? <fallback>)` instead of the hardcoded `'finance_review'`. Use `'scm_manager_review'` as the fallback only if the returned row is missing a status.
3. As a safety net, also invalidate / refetch the vendor query in `useVendorRegistration` after submission so any other consumers (and the realtime channel) see the latest row immediately. The existing realtime subscription on `vendors` already updates `vendorStatusState`, so this mainly removes the dependency on the hardcoded value.

No backend/schema changes. No changes to the submit mutation logic itself — only fixing the UI state transition so it reflects the truth the backend already wrote.

## Files to change

- `src/pages/VendorRegistration.tsx` — capture & apply real returned status in `handleSubmit` / `handleSubmissionDialogClose`.
