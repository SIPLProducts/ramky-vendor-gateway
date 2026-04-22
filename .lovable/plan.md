

## Fix: Vendor feedback submission (Yes/No + Submit not working)

### Root cause
The feedback form silently fails because of a Row-Level Security (RLS) mismatch on the `vendor_feedback` table:

- The current INSERT policy requires `auth.uid() = user_id`.
- The form (`/feedback` page and the `FeedbackPopup`) inserts `user_id: user?.id || null`.
- On the public `/feedback` route, users are usually **not signed in**, so `auth.uid()` is null → policy denies the insert.
- Even when signed in, if `user_id` is set to null (fallback), the check fails.
- The "Yes / No (would recommend)" buttons themselves work as local state — they only appear "broken" because the entire submit is rejected with no clear message.

### What will change

**1. Database — allow public feedback submissions safely**
- Drop the restrictive INSERT policy.
- Add a new INSERT policy that allows:
  - Authenticated users to insert their own feedback (`user_id = auth.uid()`), OR
  - Anonymous submissions where `user_id IS NULL` (public feedback page).
- Keep all existing SELECT policies unchanged so only admins/finance/purchase and the owner can read feedback.

```sql
DROP POLICY "Vendors can submit feedback" ON public.vendor_feedback;

CREATE POLICY "Anyone can submit feedback"
ON public.vendor_feedback FOR INSERT TO public
WITH CHECK (
  (auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR (auth.uid() IS NULL AND user_id IS NULL)
);
```

**2. Frontend — `src/pages/VendorFeedback.tsx`**
- Surface the real error message in the toast (currently it shows a generic "Submission Failed").
- Ensure `would_recommend` is always sent (already wired; confirm RadioGroup value flows correctly).
- After insert, log to console on failure for easier debugging.

**3. Frontend — `src/components/vendor/FeedbackPopup.tsx`**
- Same error surfacing improvement.
- Confirm Yes/No buttons toggle `wouldRecommend` (they do — local state works; failure was upstream).

### Out of scope
- No changes to the feedback UI design or fields.
- No changes to who can read feedback.

### Files touched
- New migration: `supabase/migrations/<timestamp>_fix_vendor_feedback_insert.sql`
- `src/pages/VendorFeedback.tsx` (better error messaging)
- `src/components/vendor/FeedbackPopup.tsx` (better error messaging)

