Update the vendor invitation email in `supabase/functions/send-vendor-invitation/index.ts` to reflect the requested wording changes.

1. Greeting line: change `Dear Valued Business Partner,` to `Dear Business Partner,`.
2. Change the third process step `Verification & Approval` to `Verification & Approval Status`.
3. Add a fourth step after the existing III item: `IV. Keep your GST, PAN, MSME (if applicable), and Bank documents ready for upload.`

After the changes, deploy the updated Edge Function so the new copy is live.