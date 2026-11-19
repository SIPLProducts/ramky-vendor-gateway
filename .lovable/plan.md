# Copy Quality Users, Roles and Approvals into Lovable

## Important limitation
Your Quality environment runs on your own server. I cannot connect to it from here, so you export the data there and upload the files to me. Then I load them into the Lovable database.

## Step 1 - You export from Quality (on your server)
Run this on the Quality database server (set QUALITY_DB_URL to the Quality database connection). It writes one CSV per table:

```text
cd /tmp && mkdir vms_export && cd vms_export
for t in profiles user_roles custom_roles custom_role_screen_permissions \
         user_custom_roles role_screen_permissions user_tenants tenants \
         buyer_approval_flows buyer_scm_mappings \
         approval_matrix_levels approval_matrix_approvers; do
  psql "$QUALITY_DB_URL" -c "\copy (select * from public.$t) to '$t.csv' csv header"
done
psql "$QUALITY_DB_URL" -c "\copy (select id,email,encrypted_password,email_confirmed_at,raw_user_meta_data,created_at from auth.users) to 'auth_users.csv' csv header"
zip -r vms_export.zip *.csv
```

Upload `vms_export.zip` here in chat.

## Step 2 - I import into Lovable
1. Create the login accounts first (same user IDs and emails, keeping their existing passwords so they can sign in with the same password).
2. Load tenants, then profiles, roles, custom roles and screen permissions, user-role links, user-tenant links.
3. Load approval data: buyer approval flows, buyer to SCM mappings, approval matrix levels and approvers.
4. Rows that already exist in Lovable (same ID or email) are updated, not duplicated. Nothing else in Lovable is deleted.

## Step 3 - Check
- Compare row counts per table with Quality.
- Open User Management (Users, Custom Roles, Role Permissions, Approval Matrix) and confirm it matches your screenshot (e.g. SAP Team 3 users, SCM CO 4 users).
- Sign in as one imported user.

## Not included
Vendors, documents, invitations and audit logs are not copied (only users and approvals as asked).

## Technical notes
- Import order respects foreign keys: auth users -> profiles/user_roles -> tenants -> custom roles -> mappings -> approval tables.
- The signup trigger auto-creates profile/role rows; production rows overwrite those via upsert.
- Quality password hashes (bcrypt) stay compatible, so passwords keep working.
