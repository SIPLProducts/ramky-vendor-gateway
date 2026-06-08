## Problem

Clicking **Begin Registration** / **Direct Link** from the invitation email on `vms.siplproducts.com` lands on:

```
https://vms.siplproducts.com/supabase/auth/v1/verify?token=...&type=magiclink&redirect_to=...
```

and shows the React `404 Page not found` screen.

## Root cause

`accept-vendor-invite` rewrites GoTrue's `action_link` so the host becomes the caller's origin and the path is prefixed with `/supabase`, expecting Nginx to proxy `/supabase/*` to Kong. On the live host that proxy rule is NOT active — every request under `/supabase/...` is served by the SPA's `index.html` (verified: `GET https://vms.siplproducts.com/supabase/auth/v1/health` returns the SPA HTML, not GoTrue). So the browser-level hit to `/supabase/auth/v1/verify` never reaches GoTrue and the React router renders `NotFound`.

We cannot change the customer's Nginx config from the app. The fix is to stop sending the browser to `/auth/v1/verify` at all and instead complete the magic-link verification through the Supabase JS SDK (which already talks to the working `VITE_SUPABASE_URL` — that's how the rest of the app works fine).

## Fix (frontend + edge function only — no other flows touched)

### 1. `supabase/functions/accept-vendor-invite/index.ts`
After generating the magic link, also extract the OTP token hash from `action_link`'s query string and include it in the response. Keep `action_link` in the response for backward compatibility — do not remove it.

```ts
// after building actionLink
let tokenHash: string | null = null;
let otpType: string | null = null;
try {
  const u = new URL(linkData.properties.action_link as string); // use the RAW link
  tokenHash = u.searchParams.get('token');     // GoTrue's hashed OTP
  otpType   = u.searchParams.get('type');      // "magiclink"
} catch {}

return new Response(JSON.stringify({
  action_link: actionLink,
  token_hash: tokenHash,
  otp_type:   otpType,
  email,
  invitation_id: invite.id,
}), ...);
```

No change to link generation, validation, user-provisioning, or the on-behalf path.

### 2. `src/pages/VendorInviteAccept.tsx`
Replace the `window.location.assign(actionUrl.toString())` step with a client-side OTP verification using the SDK:

```ts
if (data.token_hash && data.otp_type) {
  const { error: vErr } = await supabase.auth.verifyOtp({
    token_hash: data.token_hash,
    type: data.otp_type as 'magiclink',
  });
  if (vErr) {
    // fall back to the old redirect so we don't regress environments
    // where /supabase/* IS proxied to Kong correctly.
    window.location.assign(actionUrl.toString());
    return;
  }
  navigate(`/vendor/registration?token=${encodeURIComponent(token)}`, { replace: true });
  return;
}

// Fallback for old edge-function responses that don't return token_hash
window.location.assign(actionUrl.toString());
```

Everything else on this page (already-signed-in shortcut, error UI, branding) is unchanged.

### What is NOT changed

- `send-vendor-invitation` (email body, Begin Registration / Direct Link URLs — both already point at `/vendor/invite?token=...` and are correct).
- `VendorRegistration.tsx`, `useVendorRegistration.tsx`, `route-vendor-approval`, buyer-on-behalf flow, approval matrix, public-registration flow.
- Nginx, env vars, Supabase config.

## Validation

1. Click invitation link from email on `vms.siplproducts.com` while signed out → page shows "Verifying your invitation" → SDK verifies the OTP against `VITE_SUPABASE_URL` → user is signed in → redirected to `/vendor/registration?token=...`. No 404.
2. Click invitation link while already signed in as the invited email → existing shortcut still navigates straight to the registration page (unchanged).
3. Expired / invalid token → same error card as before (`code: 'expired'` / `'invalid'`).
4. If the SDK verifyOtp fails for any other reason → falls back to the previous `/supabase/auth/v1/verify` redirect so environments where Nginx IS proxying correctly keep working.
5. Public (non-invite) registration flow untouched.
