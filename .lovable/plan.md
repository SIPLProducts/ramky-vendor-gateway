I verified the issue is not caused by the latest pagination fix. The selected company in the screen is **Ramky Infrastructure Limited**, but the configured users/mappings exist under a separate active tenant record named **Ramky Infrastructure Ltd**.

Plan:

1. Update the Buyer–SCM screen to resolve tenant aliases/duplicates for the selected company.
   - When a tenant is selected, load closely matching active tenant records using tenant `code` and normalized company name.
   - Treat records like “Ramky Infrastructure Limited” and “Ramky Infrastructure Ltd” as the same company for this screen.

2. Fetch and display data across the resolved tenant IDs.
   - Load `user_tenants` for all matched tenant IDs.
   - Load `buyer_scm_mappings` for all matched tenant IDs.
   - Keep the existing paginated fetch helper so records beyond 1000 rows are still included.

3. Save new mappings against the tenant that already has assigned Buyer/SCM users when possible.
   - If the selected tenant has no assigned users but a matched tenant does, save the mapping to that matched tenant.
   - Otherwise save to the currently selected tenant as before.

4. Add a small scoped notice only when an alias/duplicate tenant is being used.
   - This will make it clear that mappings are coming from an equivalent company record, without changing unrelated UI.

No database schema changes are needed.