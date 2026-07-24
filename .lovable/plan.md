The production error is happening on the browser’s direct Storage upload:

```text
POST /storage/v1/object/vendor-documents/{vendorId}/...
new row violates row-level security policy
```

Because dev works and production still fails after policy/proxy changes, the reliable fix is to stop uploading vendor documents directly from the browser. I will move document upload into a secured backend function that verifies the logged-in user, checks vendor/invitation ownership, then uploads with backend privileges. This will work for both **email invitation vendor flow** and **Create Vendor / on-behalf flow**.

## Plan

1. **Create secured backend upload function**
   - Add `upload-vendor-document` function.
   - Accept `vendorId`, `documentType`, and `file`.
   - Verify the request Authorization token.
   - Allow upload only when the user is linked to the vendor by one of these paths:
     - `vendors.user_id = current user`
     - `vendors.invitation_id` points to an invitation where `created_by = current user` or `user_id = current user`
     - `vendor_invitations.vendor_id = vendor.id` where `created_by = current user` or `user_id = current user`
   - Upload the file to `vendor-documents/{vendorId}/{documentType}/...` using backend privileges.
   - Upsert `vendor_documents` metadata.
   - Remove the previous file for the same document type after the new file is saved.

2. **Update vendor registration upload logic**
   - Change `src/hooks/useVendorRegistration.tsx` so `uploadAllDocuments()` calls the new backend function instead of `supabase.storage.from(...).upload()` directly.
   - Keep the existing save draft and submit behavior unchanged.
   - Keep file path format the same, so DMS/SAP sync and document preview continue to work.

3. **Handle both flows explicitly**
   - Email-link vendors: authorization works through invitation `user_id` / vendor `user_id`.
   - Create Vendor/on-behalf buyers: authorization works through invitation `created_by` and `vendors.invitation_id`.

4. **Add useful production diagnostics**
   - If upload is denied, return a clear error like:

```text
Upload not allowed for this vendor and current user
```

   - This avoids the confusing Storage RLS message.

5. **Deployment note for self-hosted production**
   - After code is approved and implemented, deploy the new function to your production self-hosted server along with the frontend.
   - This fix does not require more Storage policy changes because the browser will no longer perform the failing direct Storage insert.

## Expected Result

Save Draft and Submit Application should upload documents successfully in production for both invitation/email vendors and Create Vendor/on-behalf registrations.