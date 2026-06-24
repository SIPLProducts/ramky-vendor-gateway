## Root cause
`sap-team-return-to-buyer` selects `gst_number` from `public.vendors`, but that column is named `gstin`. Postgres returns `column vendors.gst_number does not exist`, the function throws, the response is HTTP 500, and the UI shows "Return to Buyer failed — Edge Function returned a non-2xx status code".

## Fix
Edit `supabase/functions/sap-team-return-to-buyer/index.ts`:
- Change the `vendors` select list from `gst_number` to `gstin`.
- Update `getName1()` to read `v?.gstin` instead of `v?.gst_number` when deciding whether to use the trade name.

No other files change. Auth, email pipeline, and downstream update logic stay as-is.