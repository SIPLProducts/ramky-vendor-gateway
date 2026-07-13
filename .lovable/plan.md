## Goal
Reference number must equal the actual submit date in IST (`YYYYMMDDNNN`), regardless of when the draft was created. Once a real submit has happened, the number is frozen forever (resubmits/edits/approvals never change it).

## Why today's submission still shows 20260707009
- The vendor row was drafted on 07-Jul and a reference number was assigned back then.
- Current `assign_vendor_reference_number` trigger has an early `RETURN NEW` whenever `reference_number` is already set, so today's submit cannot overwrite it.
- Also, the trigger only treats `buyer_review` as a submit transition, but the app submits into `scm_manager_review` — so even for fresh rows, the stamp path is not hit consistently.

## Fix

### 1) Backend migration — reference number
Rewrite `public.assign_vendor_reference_number()` so:

- Track "already submitted" via a new column `public.vendors.submit_ref_locked_at timestamptz`.
- Trigger fires `BEFORE INSERT OR UPDATE` on `vendors`.
- Detect real submit transition (INSERT with review status, or UPDATE from a pre-submit status into any review status): 
  pre-submit = `draft, validation_pending, validation_failed, returned_to_vendor, returned_to_buyer`
  review = `buyer_review, scm_manager_review, scm_head_review, finance_1_review, finance_2_review, ceo_office_review`
- Behavior:
  - If `submit_ref_locked_at IS NOT NULL` → never touch `reference_number` (freeze after first real submit).
  - Else if this update is a real submit transition → stamp `reference_number = YYYYMMDD(IST today) + NNN` from `vendor_reference_counters`, set `submit_ref_locked_at = now()`, and also set `submitted_at = COALESCE(NEW.submitted_at, now())`. This overwrites any stale draft-era number.
  - Else → leave `reference_number` alone (drafts may or may not have one; we won't create a pre-submit one from this trigger).
- Drop duplicate trigger `trg_vendors_assign_reference_number` and keep a single `vendors_assign_reference_number` BEFORE INSERT OR UPDATE trigger.

### 2) Backend migration — on-behalf seeding
In `public.seed_vendor_approval_progress`:
- Remove the block that stamps a reference number based on `created_on_behalf` alone. Reference-number stamping is now solely owned by the trigger, driven by the real submit status transition (which the seeding path already produces). This avoids double logic and stale-date stamping.

### 3) One-time data backfill
For existing rows that already have a `reference_number` but never really submitted (still in `draft`/`validation_*`/`returned_*` and `submitted_at IS NULL`):
- Clear `reference_number` and leave `submit_ref_locked_at` NULL, so their next real submit stamps today's date.
For rows that have `submitted_at IS NOT NULL`:
- Set `submit_ref_locked_at = submitted_at` to preserve their historical reference numbers.

### 4) Frontend
`src/hooks/useVendorRegistration.tsx`:
- After the submit `UPDATE ... status = 'scm_manager_review'`, re-select the vendor row (`select reference_number, status, submitted_at`) and return that in the mutation result.
- Ensures both the success popup and the Success/Progress screen render the freshly stamped number.

`src/pages/VendorRegistration.tsx`:
- Keep the existing `submittedReferenceNumber` state; populate it from the re-selected row so Success screen and popup match.

## Expected outcomes

- Draft created 2026-07-07, submitted today 2026-07-13 → `20260713NNN`.
- Same application resubmitted after rejection → same `20260713NNN` (frozen).
- Approvals moving through SCM/Finance/CEO → number never changes.
- New buyer-invited or on-behalf submissions today → `20260713NNN`.
- Historic already-submitted rows keep their existing numbers.

## Validation
- Query active triggers on `vendors` to confirm only one reference trigger remains.
- Insert a synthetic draft dated 07-Jul, transition to `scm_manager_review`, confirm reference is `20260713NNN`.
- Update same row to `finance_1_review` and back to `returned_to_vendor` then `scm_manager_review` — confirm number does not change.