## Issues

1. **Classification Details in the View Details popup show raw uppercase codes** (`ADMIN MISCELLANEOUS, AGGREGATES`, `IMPORT`, etc.) instead of the Proper Case descriptions used in the dropdowns.
2. **Old approval rows still show the auto-generated `Approved after rejection by SCM_MANAGER — …` prefix.** The edge function was fixed to save only the raw comment, but existing `vendor_approval_progress` rows written before the fix still hold the prefixed text.

## Fix

### 1. Proper Case in `VendorReviewDialog.tsx`

- Import `useSapMasterData`.
- Fetch the 4 master types used by classification: `material_group_vendor`, `vendor_category`, `vendor_cashflow`, `tier_category`.
- Build a code → description map for each and replace the current `fmtArr(v.material_group_vendors)` / `vendor_categories` / `vendor_cashflow` / `tier_category` calls with a helper that maps each code to its description (Proper Case), falling back to the code only if no description exists.
- No changes to stored values — display only.

### 2. Backfill historical approval comments

One migration that rewrites existing rows to strip the auto prefix, matching both variants (with and without stage / trailing comment):

```sql
UPDATE public.vendor_approval_progress
SET comments = NULLIF(
  regexp_replace(
    comments,
    '^Approved after rejection( by [^—]+)?(\s*—\s*)?',
    ''
  ),
  ''
)
WHERE comments LIKE 'Approved after rejection%';
```

Rows that had no user-entered tail become NULL; rows with a tail keep only what the buyer typed.

The edge function `buyer-reapprove-rejected` was already updated last turn to stop writing the prefix, so no further code change is needed there — but I will redeploy it to guarantee production is running the fixed version.

## Result

- Classification Details popup shows Proper Case descriptions matching the dropdowns.
- Existing and future approval history entries show only the comment the approver typed — no `Approved after rejection by …` prefix.