## Goal
Update the vendor submission notification email so it reads "Ramky Vendor Portal" instead of "Sharvi Vendor Portal".

## Change
File: `supabase/functions/notify-vendor-submission/index.ts`

- Line 16: `companyName = "Sharvi Vendor Portal"` → `"Ramky Vendor Portal"`
  - This drives the email subject footer, the "review the application in the … Portal" sentence, the "Regards, … Portal" signature, and the "© 2026 … Portal" footer line.
- Line 64: hardcoded "Sharvi Vendor Portal" in the body copy → "Ramky Vendor Portal".

## Out of scope
- Support email `support@sharviinfotech.com` stays as-is (not mentioned by user).
- Other Sharvi branding across the app (Sidebar, Landing, Auth, etc.) is unchanged.
- No DB or schema changes; only the edge function is redeployed.
