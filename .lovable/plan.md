## Fix `sap-team-return-to-buyer` 500 error

**Root cause:** The edge function references a non-existent column `vendors.pan_account_holder_name`. The actual column name is `account_holder_name`.

**Change:** Edit `supabase/functions/sap-team-return-to-buyer/index.ts`:
- Line 27: replace `v?.pan_account_holder_name` with `v?.account_holder_name` in the NAME1 helper.
- Line 62: change the select list from `pan_account_holder_name` to `account_holder_name`.

No DB migration needed — column already exists. After redeploy, "Reject & Send to Buyer" will resolve the vendor name correctly (Trade Name when GSTIN present, otherwise Account Holder Name) and the 500 will be gone.