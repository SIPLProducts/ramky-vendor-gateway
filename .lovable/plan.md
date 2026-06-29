## Scope

Three copy-only edits across email bodies and support-address references. No business logic, no schema, no UI behavior changes.

## Changes

### 1. Rewrite the duplicate-closed paragraph
`supabase/functions/sap-team-reject-vendor/index.ts` (line ~159) — replace the closing sentence in the email body with:

> Vendor `<ref>` has been closed because a vendor with the same details already exists in SAP. This vendor has been moved to the **Duplicate & Closed** tab in the SAP Sync screen. No further action is required for this submission.

(Keeps the `${esc(vendorRef)}` interpolation and the bold tag on **Duplicate & Closed**.)

### 2. "Sharvi Vendor Portal" → "Ramky Vendor Portal" in email bodies only
Update every occurrence inside email HTML/subject strings sent by edge functions:

- `supabase/functions/sap-team-reject-vendor/index.ts` (footer line ~160)
- `supabase/functions/sync-vendor-to-sap/index.ts` (lines ~715, ~716 — "review this vendor in the Sharvi Vendor Portal" and "Regards, Sharvi Vendor Portal")
- `supabase/functions/process-approval-action/index.ts` (footer line ~192)
- `supabase/functions/sap-team-return-to-buyer/index.ts` (footer line ~117)
- `supabase/functions/send-password-reset/index.ts` (subject line ~50, body lines ~55 and ~70)
- `supabase/functions/send-vendor-invitation/index.ts` — default `companyName` fallback (line ~66)
- `supabase/functions/notify-vendor-submission/index.ts` — if any "Sharvi Vendor Portal" string exists in its email body (check during edit)
- `supabase/functions/smtp-config-test/index.ts` (subject line ~134)

**Out of scope** (do NOT change — these are app UI / admin config / deployment scripts, not email content): `src/pages/AdminConfiguration.tsx`, `src/pages/EmailConfiguration.tsx`, `src/pages/ResetPassword.tsx`, `src/components/admin/NoReplyEmailConfig.tsx`, `DEPLOYMENT_WINDOWS.md`, `setup-selfhost.sh`, `iis/web.config`, `middleware/*`. Touching these risks renaming the product across the admin UI and infra docs, which the user didn't ask for.

### 3. `support@sharviinfotech.com` → `vendxsupport@ramky.com` everywhere
Replace in both edge functions and UI:

- `supabase/functions/notify-vendor-submission/index.ts` (line 15 `supportEmail` constant)
- `supabase/functions/send-vendor-invitation/index.ts` (line 67 default `supportEmail`)
- `src/pages/Landing.tsx` (lines 111, 166, 278, 279, 295 — `mailto:` + visible text)
- `src/pages/SupportHelp.tsx` (lines 307, 308)
- `src/pages/VendorInviteAccept.tsx` (lines 145, 148)
- `src/pages/VendorLogin.tsx` (lines 127, 130)
- `src/components/vendor/SubmissionSuccessDialog.tsx` (lines 72, 75)

(Both the `href="mailto:..."` and the visible label get the new address.)

## Verification

- Re-grep `support@sharviinfotech.com` across the repo → expect zero hits.
- Re-grep "Sharvi Vendor Portal" inside `supabase/functions/**` → expect zero hits; matches still allowed in admin UI, infra docs, and middleware.
- Deploy edge functions whose bodies changed: `sap-team-reject-vendor`, `sync-vendor-to-sap`, `process-approval-action`, `sap-team-return-to-buyer`, `send-password-reset`, `send-vendor-invitation`, `notify-vendor-submission`, `smtp-config-test`.
- Spot-check one duplicate-close email by triggering an SAP-team reject in the SAP Sync screen and confirming the new paragraph + "Ramky Vendor Portal" footer + new support address (where applicable).
