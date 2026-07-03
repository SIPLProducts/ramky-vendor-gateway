
## Goal

Keep the "secondary email verification" security model (chosen in the last question), but fix the current situation where clicking **Begin Registration** in the invite email shows *"Unable to open invitation"* instead of sending the verification email to the vendor's mailbox.

## What the vendor should see (unchanged UX contract)

1. Vendor clicks **Begin Registration** in the buyer's email.
2. Page loads `/vendor/invite?token=…` and shows **"Verification email sent to v•••r@domain.com"**.
3. Vendor opens that second email and clicks **Open Registration** → lands on the registration form, signed in.
4. Anyone whose email doesn't match sees **Access Denied**.

Today step 2 is failing with a generic error on the self-hosted instance (206.1.23.95:9009).

## Root cause investigation

The `claim-vendor-invite` edge function fails silently at one of three points and returns codes like `verification_send_failed` / `provision_failed` without telling the user which step:

1. **SMTP lookup** — requires an `is_active=true` row with a non-null `app_password` in `smtp_email_configs`. If none exists on this environment, the send throws "No active SMTP configuration found".
2. **`auth.admin.generateLink`** — on self-hosted, this can 500 if the auth user doesn't yet exist for that email. Current code creates the user only best-effort and swallows errors.
3. **Action link rewriting** — the code rewrites the Supabase action link to the app origin and prefixes `/supabase/auth/v1/…`. If the self-hosted deployment doesn't proxy `/supabase/*` back to GoTrue, the emailed link 404s (a different failure mode, but worth verifying).

## Plan

### 1. Add a preflight diagnostics endpoint (already partly there)
Extend the existing `GET` handler on `claim-vendor-invite` to also report:
- Whether an active SMTP config exists.
- Whether `auth.admin.generateLink` succeeds for a probe email.
- Whether an auth user exists for a given `?email=` query param.

This lets us hit `GET /functions/v1/claim-vendor-invite?probe=1&email=…` from the browser and see the exact broken subsystem on 206.1.23.95:9009.

### 2. Harden the POST path

In `supabase/functions/claim-vendor-invite/index.ts`:
- Make user provisioning **required, not best-effort**. If `findUserByEmail` returns null AND `createUser` fails with anything other than "already registered", return `{code: 'provision_failed', message: <real reason>}` so the UI shows it.
- Wrap `generateLink` in its own try/catch and return `{code: 'generate_link_failed', message}` distinctly from `verification_send_failed` (SMTP).
- Wrap the SMTP transport step and return `{code: 'smtp_send_failed', message}` with the nodemailer error text.
- If no active `smtp_email_configs` row exists, return `{code: 'smtp_not_configured'}` with a human message pointing admins to the SMTP settings screen.

### 3. Fix the action-link origin rewrite

Only rewrite `action_link` to the app origin when `SUPABASE_URL` points at an internal/private host (i.e. the same origin as the app). On self-hosted where GoTrue lives at a different public host, leave the link pointing at the real GoTrue URL so the magic link actually resolves. Detect by comparing `new URL(supabaseUrl).host` to `new URL(redirectOrigin).host` and only prepend `/supabase` when they match.

### 4. Surface the specific error in the UI

`src/pages/VendorInviteAccept.tsx` already displays `code` / `raw`. Add friendly messages for the new codes:

| code | Message to vendor |
|---|---|
| `smtp_not_configured` | "Email service isn't configured yet. Please contact vendxsupport@ramky.com." |
| `smtp_send_failed` | "We couldn't send the verification email. Please contact support." |
| `generate_link_failed` | "We couldn't generate your secure link. Please contact support." |
| `provision_failed` | "We couldn't prepare your account. Please contact support." |

The technical `code` + `raw` box stays visible so support can act on it.

### 5. Verify

- Deploy the function.
- Call `GET …/claim-vendor-invite?probe=1&email=<invited-address>` from the browser on 206.1.23.95:9009 and confirm SMTP + generateLink both report OK.
- Re-send an invitation, click Begin Registration, confirm we now either (a) reach the *Verification email sent* screen, or (b) see the exact failing subsystem in the error card.

## Out of scope
- No change to the security model — forwarded recipients still cannot access the form.
- No change to buyer, approval, or registration UI.
