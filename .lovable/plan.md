## Goal
Replace the current Reference Number (first 8 chars of vendor UUID) with a daily-sequenced format: `YYYYMMDD###` (e.g. `20260609001`, `20260609002`, … resetting to `001` each new day).

## Changes

### 1. Database (migration)
- Add column `reference_number text` (unique, nullable) on `public.vendors`.
- Add a counter table `public.vendor_reference_counters (date date primary key, last_seq int not null default 0)` with proper GRANTs (service_role only — used by trigger).
- Create a `BEFORE INSERT` trigger on `vendors` that, when `reference_number` is null:
  - Takes today's date (UTC or `Asia/Kolkata` — defaulting to project timezone, will use `(now() AT TIME ZONE 'Asia/Kolkata')::date` since this is an India-facing portal).
  - Atomically `INSERT … ON CONFLICT (date) DO UPDATE SET last_seq = last_seq + 1 RETURNING last_seq` to get the next sequence safely under concurrency.
  - Sets `NEW.reference_number = to_char(d,'YYYYMMDD') || lpad(seq::text,3,'0')`.
- Backfill existing vendor rows: order by `created_at`, group by date, assign sequential numbers.

### 2. Frontend
- `src/components/vendor/SuccessScreen.tsx` — display `vendor.reference_number` instead of `vendorId.slice(0,8).toUpperCase()`. Fallback to the old value if the field is missing.
- Pass `referenceNumber` prop through from the parent (`VendorRegistration.tsx` / wherever `SuccessScreen` is rendered) by reading it from the vendor row after submission.
- `src/pages/SAPSync.tsx` (line 417) — prefer `vendor.reference_number` for the displayed reference (kept `sap_reference_no` fallback unchanged).

### 3. Out of scope
- No changes to SAP payload template (`vendor.reference_no` token mapping in `sapPayloadBuilder.ts` / `sync-vendor-to-sap` is unrelated to this UI Reference Number and remains as-is).
- No change to `sap_reference_no` column.

## Technical Notes
- Trigger uses an upsert on the counter table so concurrent inserts can't collide — Postgres serializes the `ON CONFLICT DO UPDATE` row lock.
- Format zero-pads to 3 digits as specified; if a single day ever exceeds 999 vendors the format naturally widens (`lpad` with min 3) — acceptable since the spec shows 3-digit examples.
- Timezone: `Asia/Kolkata` so the day rolls over at midnight IST, matching vendor working hours.
