# Reference number: generate on SUBMIT for both flows (on-behalf & via-invitation)

## New rule (applies to both paths)

- Ref number is assigned **only when the vendor is submitted** — never on draft creation.
- Format: `YYYYMMDD` (submit date, IST) + 3-digit sequence.
- Sequence uses **the submit date's counter** in `vendor_reference_counters`, incremented atomically. First submit of the day = `001`, next = `002`, etc.
- Once assigned, the number is frozen — re-submit, re-open, or later status changes never re-number.

Applies uniformly to:
- **Via-invitation flow** — vendor completes the form and submits (status moves `draft → buyer_review` / next review stage).
- **On-behalf flow** — buyer inserts the vendor directly with a submitted status.

## Database changes (single migration)

1. **Modify** `public.assign_vendor_reference_number()` into an "assign if submitted" function:
   - Keep the guard: if `NEW.reference_number` is already set, return.
   - Only proceed when `NEW.status` is a submitted/review status:
     `buyer_review, scm_manager_review, scm_head_review, finance_1_review, finance_2_review, ceo_office_review, pending_sap_sync, sap_synced`.
   - Compute `v_date := (now() AT TIME ZONE 'Asia/Kolkata')::date`.
   - Upsert `vendor_reference_counters` for `v_date` with `ON CONFLICT (date) DO UPDATE SET last_seq = c.last_seq + 1 RETURNING last_seq INTO v_seq`.
   - Set `NEW.reference_number := to_char(v_date,'YYYYMMDD') || lpad(v_seq::text,3,'0')`.

2. **Drop** the current `BEFORE INSERT` trigger and **create** a single `BEFORE INSERT OR UPDATE` trigger on `public.vendors` calling the updated function. This covers:
   - Via-invitation: draft INSERT → skipped; later UPDATE to `buyer_review`/etc. → number assigned using that day's counter.
   - On-behalf: INSERT already with `scm_manager_review` → number assigned immediately using that day's counter.

3. **No backfill.** Existing rows with a ref number (e.g. `20260708001`) stay as-is. Draft rows without a number will get one on their next submit.

## Frontend

- No code change required. UI reads `vendor.reference_number` as it does today. Draft rows without a number display blank until submitted (same as any nullable field). Say the word if you want a placeholder like `—` or `Not submitted` for draft rows in the vendor list.

## Verification

- `bunx tsgo --noEmit` clean.
- SQL checks:
  - Insert a draft vendor → `reference_number IS NULL`, no counter row created.
  - Update that vendor to `buyer_review` today → number = `YYYYMMDD001` (or next seq for today).
  - Insert an on-behalf vendor today with `scm_manager_review` → number uses same day's counter, increments correctly.
  - Two submits on the same day → sequence goes `...001`, `...002`.
  - Change status again on an already-numbered vendor → number unchanged.

## Ready to build

Reply **"go"** and I'll switch to build mode and run the migration.
