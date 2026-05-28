
# Vendor Registration — fix save errors, buyer company reset, and clean up Continue buttons

Four real problems from the screenshots:

1. **"new row violates row-level security policy for table vendors"** when autosave runs while clicking Continue to PAN/MSME/Bank.
2. **"Couldn't save — will retry"** badge in the header (same root cause — every failed autosave shows it).
3. **Buyer Company is blank** on Organization Profile even though the invitation already has a tenant assigned, and it resets every time the vendor returns via the invitation link.
4. The per-tab **Continue to PAN / Continue to MSME / Continue to Bank** buttons feel redundant alongside the outer Save Draft / Continue bar at the bottom.

## Root causes

- The `vendors` INSERT policy requires `user_id = auth.uid()` and the UPDATE policy requires `user_id = auth.uid() AND status = 'draft' …`. In `useVendorRegistration.saveVendorMutation`, `user_id` comes from `supabase.auth.getUser()` and is sent on **every** save (including updates). If the existing draft row was created earlier with a different/null `user_id`, or the session refresh races with an autosave triggered by clicking the inner Continue buttons, the row's `user_id` no longer matches `auth.uid()` and the update is rejected — surfaced as the red "Error Saving Data" toast and the persistent "Couldn't save — will retry" badge.
- `OrganizationStep` uses RHF `defaultValues` only on first mount and the `Select` is `disabled`, so once the form mounts with an empty `buyerCompanyId` (which happens before the invitation/`existingVendor` payload arrives, or when the vendor re-opens the link), the field stays blank forever — even though `invitation.tenant_id` is known and `useVendorRegistration` already force-overrides `tenant_id` server-side.
- The inner "Continue to PAN/MSME/Bank" buttons (added last round) only switch tab state, but the form's `watch`/autosave fires a save attempt on every tab change. Combined with the RLS issue above, every click produces the same error toast.

## Fixes

### 1. Stop autosave from breaking on tab switches and stop overwriting `user_id`

In `src/hooks/useVendorRegistration.tsx` (`saveVendorMutation`):

- On **update** (`vendorId` already set), strip `user_id` from the payload so we never try to change ownership of an existing draft row. Only send `user_id` on the initial **insert**.
- Always force `tenant_id` from `invitation.tenant_id` when present (already done) and additionally hydrate it from `existingVendor.tenant_id` on update so we never null it out.
- Wrap the mutation in a small "skip if nothing changed since last save" guard so switching tabs doesn't fire a redundant write.

### 2. Make autosave indicator honest

In `src/components/vendor/AutoSaveIndicator.tsx` and the autosave caller in `VendorRegistration.tsx`:

- Treat `42501` / RLS errors specifically — show a one-time toast and switch the badge to "Saved locally — sign in to sync" instead of looping the "Couldn't save — will retry" message forever.
- Clear the error state as soon as the next save succeeds.

### 3. Buyer Company should auto-fill from the invitation and never reset

In `src/components/vendor/steps/OrganizationStep.tsx`:

- Add a `useEffect` watching the incoming `tenantId` prop (already passed from `VendorRegistration.tsx`) and `data.buyerCompanyId`. When either changes and the form's current `buyerCompanyId` is empty, call `setValue('buyerCompanyId', tenantId ?? data.buyerCompanyId, { shouldDirty: false })`.
- In `VendorRegistration.tsx`, pass the resolved `tenantId` (already computed at line 121) into `OrganizationStep` (currently passed but ignored — wire it through and also seed `formData.organization.buyerCompanyId` once when the invitation/`existingVendor` arrives, so re-entering the link always shows the assigned buyer).

### 4. Remove the per-tab "Continue to PAN/MSME/Bank" buttons, keep one Continue + Save Draft

In `src/components/vendor/steps/DocumentVerificationStep.tsx`:

- Delete the four `<div className="mt-4 flex justify-end"> <Button>Continue to …</Button> </div>` blocks added last round (GST → PAN, PAN → MSME, MSME → Bank, Bank → Continue) at ~lines 1908, 2025, 2385, 2646.
- Keep the existing outer **Save Draft** and **Continue** buttons in `StickyActionBar` — the outer Continue already advances to step 2 once `allDone` is true. Tab switching stays available via the tab headers at the top of the stage card.
- Update the helper banner text from "Complete each stage in order: GST → PAN → MSME → Bank" to make clear that the single bottom **Continue** unlocks when all four stages are green.

## Out of scope

- No database/RLS policy changes, no migrations, no edge functions.
- No changes to the verification logic (GST/PAN/MSME/Bank API calls), OCR, or KYC providers.
- No styling/design-system changes beyond removing four button blocks and one helper line.

## Files touched

- `src/hooks/useVendorRegistration.tsx` — guard `user_id` on update, preserve `tenant_id`, dedupe redundant saves.
- `src/components/vendor/AutoSaveIndicator.tsx` + `src/pages/VendorRegistration.tsx` — better RLS error handling for the header badge, seed `buyerCompanyId` from invitation/existingVendor.
- `src/components/vendor/steps/OrganizationStep.tsx` — sync `buyerCompanyId` from `tenantId` prop via `setValue`.
- `src/components/vendor/steps/DocumentVerificationStep.tsx` — remove four per-tab Continue buttons, update helper banner.

## Verification

- Reload an invitation link as a vendor → Organization Profile shows the assigned Buyer Company pre-filled and locked.
- Fill GST stage → switch tabs via the tab header → no red "Error Saving Data" toast, no persistent "Couldn't save — will retry" badge.
- Complete all four stages → the single bottom **Continue** button enables and advances to Step 2.
- Refresh mid-registration → all previously entered fields (including Buyer Company) reload from the draft.
