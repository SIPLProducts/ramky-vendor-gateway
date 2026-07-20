## Fixes for Vendor Registration

### 1) MSME — hide the certificate upload area entirely until Udyam verifies
File: `src/components/vendor/kyc/MsmeKycTab.tsx`

Currently, when the user selects "Yes" for MSME registered, a two‑column grid renders with the Udyam number on the left and either the upload card OR a dashed "Verify first" placeholder on the right. That placeholder is why the "Upload Udyam Certificate *" area still appears before verification.

Change:
- Remove the dashed placeholder branch.
- Render the Udyam Number field full width when unverified.
- Only after `manualApiResult?.ok === true`, render the "Upload Udyam Certificate" card below the number field (single column stack, no placeholder).

Result: after choosing "Yes", the user sees only the Udyam Number + Validate button. The upload area appears only once verification succeeds.

### 2) Contact Details tab — 3 columns everywhere
File: `src/components/vendor/steps/AddressStep.tsx`

Convert every field grid in this step to 3 columns. Currently several sections use `md:grid-cols-2` and one uses `md:grid-cols-4`. Change all of these to `md:grid-cols-3` (lines 353, 376, 400, 427, 621, 710, 752). Leave the existing `md:grid-cols-3` grids as-is. Full‑width fields (single address line, textareas) remain full width.

### 3) Refresh no longer wipes the form
Two problems combine to cause the reset the user is seeing:

a. There is no "unsaved changes" confirmation on refresh anymore (removed earlier). Users hit F5 or the reload button and lose in‑progress edits that haven't been auto‑saved yet.

b. On a hard refresh, `authUserId` starts as `null`, so the `existing-vendor` query is disabled. `isLoadingVendor` is therefore `false`, the loading spinner guard passes immediately, `vendorTypeChosen` is still `false`, and the **Vendor Type selector** briefly renders — which visually looks like the draft was lost. Only after Supabase auth hydrates does the draft load.

Fixes:

- **`src/pages/VendorRegistration.tsx`**
  - Re-add a `beforeunload` handler that shows the browser's "Changes you made may not be saved." prompt whenever the form has been touched and is not currently saved / submitted. Uses a `hasUnsavedChangesRef` flag that flips to `true` on any `setFormData` and back to `false` after each successful auto-save. Skips the prompt entirely when `isSubmitted` or when the user is on the Vendor Type selector.
  - Extend the loading gate at line 1518 so it also waits for auth hydration and for the existing-vendor query to have actually run. Concretely: pass `authUserId` (or an `isAuthReady` boolean) out of `useVendorRegistration` and treat `!isAuthReady || isLoadingVendor` as loading. This prevents the Vendor Type selector from flashing while the draft is still being fetched after a refresh.

- **`src/hooks/useVendorRegistration.tsx`**
  - Track an `isAuthReady` boolean that becomes `true` after the initial `supabase.auth.getUser()` resolves (regardless of whether a user is present). Return it from the hook alongside `isLoadingVendor`.

Behavior after these changes:
- Refresh with unsaved edits → browser asks "Reload site? Changes you may have made will not be saved." (native prompt, matches the earlier UX).
- Refresh after a draft was auto-saved / Save Draft clicked → spinner shows until auth hydrates and the draft loads, then the form re-opens on the correct step with all saved data. No flash of the Vendor Type selector.
- Closing the tab and reopening the same invitation link later → same flow: spinner → draft (or submitted view) restores automatically, because the draft lives in the `vendors` table keyed to the auth user + invitation.

### Technical notes
- No schema changes.
- No changes to auto-save cadence, submission logic, or validation.
- `beforeunload` prompt text is controlled by the browser; we can only opt in/out via `event.preventDefault()` + `returnValue`.
- The `isAuthReady` flag is derived from the existing `supabase.auth.getUser()` promise already present in `useVendorRegistration` — no extra network calls.