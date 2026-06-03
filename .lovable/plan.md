## Goal
Make the built-in `admin` role's screen permissions identical to `sharvi_admin`, except keep KYC API Settings disabled for `admin`.

## Current diff (role_screen_permissions)

| screen_key | sharvi_admin | admin (current) | admin (new) |
|---|---|---|---|
| sharvi_admin_console | true | (missing) | **true** |
| kyc_api_settings | true | true | **false** |
| finance_review | false | true | **false** |
| sap_sync | false | true | **false** |
| vendors | false | true | **false** |
| (all others) | true | true | true (unchanged) |

## Change
One data migration on `public.role_screen_permissions`:

1. Upsert `('admin','sharvi_admin_console', true)`.
2. Update `('admin','kyc_api_settings')` → `can_access = false`.
3. Update `('admin', screen_key)` → `can_access = false` for `finance_review`, `sap_sync`, `vendors` to mirror sharvi_admin.

No code, RLS, route-guard, or UI changes — the sidebar/route gating already reads from `role_screen_permissions` via `useScreenPermissions`, so updates propagate automatically.

## Out of scope
- No changes to custom roles, RLS policies, or other built-in roles.
- No edge-function or workflow changes.

## Note / confirmation
Sharvi Admin currently has `vendors`, `finance_review`, and `sap_sync` **disabled**. Mirroring exactly will remove these from Admin too. If you'd rather keep those three enabled for Admin (and only flip `kyc_api_settings` off + add `sharvi_admin_console`), say so and I'll adjust before applying.
