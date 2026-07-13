## Goal
Reference number = **date the application is first submitted** (Asia/Kolkata) + 3-digit daily sequence starting at `001`.
- New submit today (via vendor-invite email link OR buyer on-behalf submit) → `20260713001`, `20260713002`, …
- Edit / resubmit of an existing application → **keep the same reference number** (never re-stamp).

## Why 20260708009 happened
Current `assign_vendor_reference_number` trigger stamps on the first status transition into any review state. For your vendor, that first transition happened on 08-Jul (either buyer-on-behalf seed advanced status early, or an earlier submit that was later returned to vendor). Today's resubmit correctly did not change the number — but the original stamp date was earlier than what you consider the "submit" moment.

## Fix (DB migration only, no UI changes)

### 1. Tighten `public.assign_vendor_reference_number()`
- Keep: if `reference_number` already set → return (never re-number, resubmit-safe).
- Change: only stamp on a real "submit" transition:
  - `TG_OP='INSERT'` AND `NEW.status='buyer_review'`, OR
  - `TG_OP='UPDATE'` AND `NEW.status='buyer_review'` AND `OLD.status IN ('draft','validation_pending','validation_failed','returned_to_vendor','returned_to_buyer')`.
- Do **not** stamp on transitions to `scm_manager_review` / `finance_*_review` / `ceo_office_review` / `pending_sap_sync` / `sap_synced` — those are approver actions, not submissions.
- Date source unchanged: `(now() AT TIME ZONE 'Asia/Kolkata')::date`; sequence unchanged: `vendor_reference_counters`.

### 2. Patch `public.seed_vendor_approval_progress(_vendor_id)`
When buyer submits on-behalf (`v_on_behalf = true`) and the vendor row has no `reference_number` yet:
- Allocate a new ref using **current IST date** + `vendor_reference_counters` and set it on `vendors` **before** flipping status to the next stage.
- This guarantees on-behalf submissions get today's date even though the buyer_review stage is auto-completed.

### 3. Trigger unchanged
`vendors_assign_reference_number` stays `BEFORE INSERT OR UPDATE`.

## Behaviour matrix

| Scenario | Ref number |
|---|---|
| Vendor submits via email invite today | today (`20260713NNN`) |
| Buyer submits on-behalf today | today (`20260713NNN`) |
| Buyer only saved draft on-behalf 2 days ago, clicks Submit today | today (`20260713NNN`) |
| Buyer submitted on-behalf 2 days ago (no submit action today) | 2 days ago (`20260711NNN`) — that WAS the submit day |
| Vendor edits/resubmits after `returned_to_vendor` | unchanged (original submit-day number) |
| Approver moves through SCM / Finance / SAP | unchanged |

## Not changed
- Format `YYYYMMDD` + 3-digit sequence.
- Frontend components (`SuccessScreen`, `VendorStatus`) — they just render `vendors.reference_number`.
- No backfill of existing vendor numbers.

## Verification
- Insert or update a test vendor to `buyer_review` today → new ref = `20260713NNN`.
- Move a vendor with existing ref to `returned_to_vendor` and back to `buyer_review` → ref stays the same.
- Advance any vendor through approver stages → ref stays the same.

## Out of scope (ask if you want)
- Rewriting existing vendors' historical reference numbers.
