# Fix: Vendor submission blocked by RLS

## Root cause

On submit, `useVendorRegistration` updates the vendor row with `status = 'scm_manager_review'` (the new SCM-first approval flow). But the existing RLS policy `"Vendors can update own draft data"` on `public.vendors` has a `WITH CHECK` that only permits the new status to be one of:

```
draft, submitted, validation_pending, finance_review, purchase_review
```

`scm_manager_review` is not in that list, so Postgres rejects the UPDATE with:

> new row violates row-level security policy for table "vendors"

This is why the toast says "Submission Failed" right at the end of step 6.

## Fix

Drop and recreate the `Vendors can update own draft data` policy so the WITH CHECK also allows the SCM/Finance/CEO review statuses the vendor's submit/resubmit transitions into:

```
draft, submitted, validation_pending,
purchase_review, finance_review,
scm_manager_review, scm_head_review,
finance_1_review, finance_2_review,
ceo_office_review
```

USING clause stays the same (vendor can only edit their own row while it's in `draft`, `validation_failed`, or `finance_rejected`) — so this only widens what the row may transition *into*, not which rows the vendor can touch.

No frontend code changes. After the migration, submission will go through and the existing success dialog + buyer notification email will fire as designed.

## Out of scope

- No changes to other vendor RLS policies.
- No changes to the submit flow, notification function, or success dialog.
- The duplicate-document concurrency fix from the previous turn stays as-is.
