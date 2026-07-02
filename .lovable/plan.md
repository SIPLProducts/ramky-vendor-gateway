## Problem

Vendor form fields (Organization, GST, PAN, MSME, Bank, Address, Contact, Classification, Documents) are being lost when the vendor edits or when the application is returned for corrections.

## Root causes found

1. **Step forms don't re-sync with late-arriving data.** Every step (`OrganizationStep`, `AddressStep`, `ContactStep`, `FinancialInfrastructureStep`, `DocumentVerificationStep`, `ComplianceStep`, all `international/*` steps) initializes `useForm({ defaultValues: data })`. React Hook Form only reads `defaultValues` at mount. If the step renders before the vendor record has hydrated (fresh load, refetch after save, or when navigating into a step while `existingFormData` is still loading), the form keeps its empty defaults. When the user clicks **Next**, RHF submits those empty values, overwriting the previously saved slice in the parent `formData`.

2. **Autosave writes the full record.** `saveVendor` builds a complete `vendors` row from the entire `formData` on every autosave via `formDataToVendorRecord`. Any slice that is still empty in `formData` (because the step form above never populated it) is written to the DB as `null`/empty string. This is what makes previously entered GST / PAN / MSME / Bank / Address / Contact fields disappear on the next reload.

3. **Hydration effect runs only once.** `formDataLoadedRef` in `VendorRegistration.tsx` guarantees `setFormData(existingFormData)` runs a single time. After a save/refetch, the ref never re-fires, so a fresh authoritative record from the DB is not re-applied even if the local `formData` has drifted.

## Fix plan

### 1. Make every step re-sync when its `data` prop changes

For each step below, switch to RHF's controlled sync so late/refreshed data is applied:

- `src/components/vendor/steps/OrganizationStep.tsx`
- `src/components/vendor/steps/AddressStep.tsx`
- `src/components/vendor/steps/ContactStep.tsx`
- `src/components/vendor/steps/FinancialInfrastructureStep.tsx`
- `src/components/vendor/steps/ComplianceStep.tsx`
- `src/components/vendor/steps/DocumentVerificationStep.tsx` (mirror `verifiedData` + persisted files back into local stage state when the incoming props change)
- `src/components/vendor/steps/international/IntlDocumentsStep.tsx`
- `src/components/vendor/steps/international/IntlCompanyDetailsStep.tsx`
- `src/components/vendor/steps/international/IntlBankDetailsStep.tsx`
- `src/components/vendor/steps/international/IntlClassificationStep.tsx`

Change pattern: pass `values: data` to `useForm` (RHF v7 keeps this in sync automatically) **or** add a `useEffect(() => reset(data), [data])`. Guard the reset so it does not clobber the user's unsaved keystrokes (skip when `formState.isDirty` is `true`).

### 2. Gate autosave and full-record writes until hydration is complete

In `src/pages/VendorRegistration.tsx`:

- Do not run the debounced autosave until `formDataLoadedRef.current === true` (existing record has been merged into `formData`). Today autosave only skips one tick via `isFirstAutoSaveRef`, which is not enough when the vendor record loads a few hundred ms after mount.
- Recompute `lastSavedHashRef` from the hydrated `formData` right after the initial merge so the first user edit is what triggers autosave, not the hydration itself.

### 3. Never write empty slices over saved data

In `src/hooks/useVendorRegistration.tsx` `saveVendorMutation` (update branch, ~line 851):

- After building `updatePayload` via `formDataToVendorRecord`, strip keys whose value is `null`/`''`/empty array **when the same key on the loaded `existingVendor` currently has a non-empty value**. This preserves DB values for any slice the user has not touched in this session.
- Keep explicit clears working: allow through fields where `formData` explicitly sets `false`/`0`/`null` because the user toggled them (e.g. `is_gst_registered`, `same_as_registered`, secondary bank cleared). Handle those via an allow-list of boolean/flag columns that always pass through.

### 4. Re-apply DB truth after each successful save

- After `saveVendorMutation` resolves, invalidate the `existingVendor` query and let a small companion effect re-run hydration when the fetched row is newer than what's in `formData` (guard: only merge fields the user is not currently editing — reuse the `formState.isDirty` check from step 1 by keeping form syncing controlled).

### 5. Document upload persistence

Keep the recent `vendor_documents` hydration work in place. Extend the same `reset(data)` pattern to `DocumentVerificationStep` so that `persistedFile` metadata (name/size/status) reappears when the user returns to Step 1 during an edit, and the "Uploaded" pill / green tile stays lit even when the raw `File` object is not in memory.

## Technical notes

- RHF `values` prop reference: passing `values` to `useForm` makes the form fully controlled by the parent's data object — the correct primitive for "the source of truth can change after mount".
- The autosave hash currently stringifies `formData`; after the hydration-gate fix, seed `lastSavedHashRef.current = JSON.stringify(hydratedFormData)` inside the same effect that sets `formDataLoadedRef.current = true` to avoid a spurious first save.
- The whitelist for step 3 should include at minimum: `is_gst_registered`, `is_msme_registered`, `same_as_registered`, `self_declared`, `terms_accepted`, `bank_name_2` / `account_number_2` / etc. (when `secondary.enabled === false`), and any admin-defined custom flag columns.
- No schema changes. No new tables. No new edge functions.

## Out of scope

- Buyer-side approval screen edits (no changes there).
- SAP payload builder (already reads from `vendors` row directly).
