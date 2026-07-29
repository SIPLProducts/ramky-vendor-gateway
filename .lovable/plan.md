## GST Re-Upload / Replace — Full Reset & Refresh

Ensure that whenever GST data changes in any way, all previously-populated fields are cleared before the new values are applied. Buyer Company assignment is never touched.

### 1. Detect every GST change scenario

In `src/pages/VendorRegistration.tsx` extend the reset logic in `mergeVerifiedDataIntoForm` (and equivalent handlers) to fire on all of the following, not just a new GSTIN:

- New GST certificate uploaded / re-uploaded / replaced.
- Verified GSTIN differs from previously stored GSTIN.
- GST toggle switched Yes → No or No → Yes.
- Non-GST path: user changes `manualLegalName` or `manualAddress`.

A single helper `resetGstDerivedFields(prev)` returns a form slice with all GST-derived data cleared, so all four scenarios share identical reset behavior.

### 2. Fields cleared on every GST change

**Organization**
- Legal Name of Organization
- Trade Name / Brand Name
- Type of Industry
- Type of Organization
- Type of Ownership
- State (when previously derived from GST)

**Registered / Corporate Office Address**
- Address Line 1–4
- City
- District
- State
- Country
- PIN Code

**Contact Details**
- Email 1, Email 2
- Contact 1, Contact 2

Buyer Company (`organization.buyerCompanyId`), invitation metadata, and manually-entered non-GST fields the vendor still owns are explicitly excluded from the reset.

### 3. Repopulate from latest source only

After clearing, apply the new source's values:

- **GST Yes path** — populate from the latest GST Verification API response (legal name, trade name, address parts, state via GSTIN prefix, etc.). Legal Name and Trade Name become read-only, sourced from the API.
- **GST No path** — Legal Name becomes the PAN Holder Name (read-only once PAN is verified) and address comes from `manualAddress`.
- Any field not returned by the new source stays blank and remains editable so the vendor can complete it.

### 4. Make child forms honor the reset

`OrganizationStep.tsx`, `AddressStep.tsx`, and `ContactStep.tsx` use `react-hook-form` with `values: formValues` plus `keepDirtyValues: true`, which currently preserves stale manual selections (e.g. Type of Industry) after a parent reset. On a GST-change reset, force these forms to accept the cleared parent state by either bumping a reset key or calling `reset(newValues, { keepDirtyValues: false })` for that one cycle. Buyer Company sync effect is left unchanged.

### 5. Verification

1. Start registration for Vendor A, verify GST → org/address/contact populate.
2. Without refreshing, upload Vendor B's GST → confirm every field listed above is cleared and then repopulated only with Vendor B's data.
3. Toggle Yes → No → confirm GST-derived fields clear, Legal Name switches to PAN Holder Name.
4. Toggle No → Yes and re-verify → confirm manual address/legal name clear.
5. Confirm Buyer Company remains assigned throughout all of the above.

### Technical details

- **File:** `src/pages/VendorRegistration.tsx` — add `resetGstDerivedFields(prev)` helper; call it from `mergeVerifiedDataIntoForm` on any GSTIN change, from `handleGstRegisteredChange` on Yes↔No toggle, and from the non-GST `manualLegalName` / `manualAddress` change effect. Merge new values onto the reset slice, not onto the previous state.
- **File:** `src/components/vendor/steps/OrganizationStep.tsx` / `AddressStep.tsx` / `ContactStep.tsx` — pass a `resetKey` prop derived from GSTIN + toggle + manual-legal-name hash; `useEffect(() => reset(values, { keepDirtyValues: false }), [resetKey])` to force acceptance of cleared parent values on GST change.
- No schema changes, no backend changes.