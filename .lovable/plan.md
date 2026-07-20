
## Fix 1 — Restore verification messages below verified OCR inputs

In `src/components/vendor/steps/DocumentVerificationStep.tsx`, `EditableOcrField` currently only shows the `verifiedLabel` text (e.g. "Verified from registry", "DOB verified from registry") as a hover tooltip on the green tick. Add it back as a small green line **below the input** whenever the value matches the API/registry value.

Change: below the input's `<div className="relative">…</div>`, add:

```tsx
{matchesApi && verifiedLabel && (
  <p className="mt-1 flex items-center gap-1 text-[11px] text-success">
    <CheckCircle2 className="h-3 w-3" />
    <span>{verifiedLabel}</span>
  </p>
)}
```

Result: fields like Legal Name, Trade Name, GSTIN, PAN, DOB, IFSC, Bank Name, Account Holder, etc. show a green "Verified from registry" / "DOB verified from registry" line under the field again — while the green bottom border and inline tick are kept. The orange mismatch message (with "Use registry value") is already rendered and stays untouched.

## Fix 2 — Draft data lost after browser refresh (form returns to Vendor Type screen)

Root cause (unconfirmed pending a live check, but strongly indicated by the code): in `src/hooks/useVendorRegistration.tsx` the `existing-vendor` `useQuery`:

- runs immediately on mount,
- calls `supabase.auth.getUser()` and **returns `null` if `user` is not yet hydrated**,
- has a `queryKey` that does NOT depend on the authenticated user id, so it never re-runs once auth finishes hydrating.

On a hard refresh, Supabase auth hydration frequently completes *after* the query fires → query resolves `null` → `existingFormData` stays `null` → `VendorRegistration.tsx` renders the Vendor Type selector (`!vendorTypeChosen`) instead of the saved draft.

Change in `src/hooks/useVendorRegistration.tsx`:

1. Track auth user id via `supabase.auth.onAuthStateChange` + initial `getUser()` in a small `useState<string | null>`.
2. Gate the `existing-vendor` query with `enabled: !!userId || !!options?.onBehalfInvitationId` and include the user id in the `queryKey` so it refetches once auth is ready.
3. Inside `queryFn`, keep the existing `user_id`/`invitation_id` filter but rely on the resolved id from state rather than re-calling `getUser()` (still fall back to `getUser()` for safety).

This ensures the saved draft is loaded on every refresh, which then lets the existing effect at `VendorRegistration.tsx` line 779 hydrate `formData`, call `setVendorTypeChosen(true)`, and land the user on the correct step instead of the Vendor Type selector.

No other UI is changed; the Buyer Company / Firm Reg / Memberships tweaks and other prior changes are untouched.

## Files touched

- `src/components/vendor/steps/DocumentVerificationStep.tsx` (add below-input verified message in `EditableOcrField`)
- `src/hooks/useVendorRegistration.tsx` (auth-gated existing-vendor query so refresh rehydrates the draft)
