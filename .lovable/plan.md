## Plan

1. **Fix header tenant selector**
   - Keep `All Tenants` as a real selectable option for buyers with multiple assigned companies.
   - Ensure choosing it sets the global tenant context to `null` and persists `__all__` instead of reverting to the first company.

2. **Fix Vendor Invitations page override**
   - Remove the page-level logic that forces buyers back to the first company when `activeTenantId` is `null`.
   - Use `activeTenantId` only for table filtering; when it is `null`, show invitations across all assigned companies.

3. **Keep creation forms company-specific**
   - Invitation creation / Create Vendor dialogs will still require a specific company.
   - If the header is on `All Tenants`, the dialog can default to the first available company inside the dialog without changing the global header selection.

4. **Verify behavior**
   - Confirm the header displays `All Tenants` after selection.
   - Confirm the invitation table is no longer filtered to only the first company when `All Tenants` is selected.