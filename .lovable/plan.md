## Plan

1. **Fix invitation `already_used` behavior**
   - Update the invite claim function so an already-used invitation is allowed when it belongs to the same invited vendor email or linked vendor user.
   - If the vendor clicks their own invitation link again, send them into the existing registration/resume flow instead of showing “Unable to open invitation”.
   - Keep forwarded/copied links blocked for different users/accounts with a clear **Access Denied** message.

2. **Make the invitation error screen accurate**
   - Ensure `{ status: "denied", code: "already_used" }` always renders **Access Denied**, not the generic “Unable to open invitation”.
   - Add handling for “same vendor already claimed” so the page redirects to the registration form/resume page.

3. **Restore saved GST/PAN/MSME/Bank details during edit/resubmit**
   - Fix the registration form hydration so existing saved values populate Step 1 consistently when a returned/rejected vendor opens the form.
   - Include GST legal/trade/address/status fields, PAN holder/status, MSME enterprise/category/activity, primary and secondary bank details.
   - Add `returned_to_buyer` to any remaining editable-status checks so buyer-edited rejected applications do not open as a submitted/blank screen.

4. **Preserve uploaded files and document indicators**
   - Load existing `vendor_documents` metadata for the vendor and map it into the form’s verified Step 1 state.
   - Show previously uploaded files as already present, without requiring re-upload unless the user replaces them.
   - Ensure save/resubmit keeps existing document rows and only replaces the file when a new file is selected.

5. **Backend/RLS support for self-hosted server**
   - Add a migration/RLS adjustment if needed so vendors and buyers can read the relevant existing document metadata during returned edit flows.
   - This will be important for your server deployment, where the issue is currently happening.

6. **Deployment note for server**
   - After approval and implementation, the updated frontend, migration, and edge function must be deployed to your self-hosted server; otherwise the server will continue showing the old behavior.