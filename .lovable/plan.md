# Address auto-flow + Contact/Email visibility in review screens

## 1. Auto-flow Address Line 1 when pre-populated

Today in `src/components/vendor/steps/AddressStep.tsx`, `splitAddressIntoLines` runs only inside the Line 1 `onChange` handler. When the form mounts with an already-populated long `registeredAddress` (for example a returning vendor or restored draft), the text is **not** auto-split — it just sits oversized in Line 1 and triggers the "max 40" validation error.

Fix: run the same split once on mount whenever the defaulted `registeredAddress` is longer than 40 characters AND Lines 2–4 are still empty.

- Add a `useEffect` (run only on mount / when `data` identity changes) inside `AddressStep`:
  - If `data.registeredAddress?.length > 40` and `!data.registeredAddressLine2 && !data.registeredAddressLine3 && !data.registeredAddressLine4`, call `splitAddressIntoLines(data.registeredAddress)` and `setValue` Lines 1–4 with `shouldDirty: true, shouldValidate: true`.
- Do the same defensive split for `manufacturingAddress` and `branchAddress` if they also arrive pre-populated > 40 chars (keeps behaviour symmetric with how typing already works elsewhere on the form).
- Existing `handleAddressLine1Change` keeps working unchanged for live typing.

This guarantees that whenever the Registered/Corporate Office Address card opens with data already in it, overflow has already cascaded into Lines 2–4 and no validation error is shown.

## 2. Show Contact 1, Contact 2, Email 1, Email 2, City, State across all review/preview/approval screens

The data is already captured (`registeredContact1`, `registeredContact2`, `registeredEmail`, `registeredEmail2`, `registeredCity`, `registeredState`) and persisted to DB columns `registered_contact_1`, `registered_contact_2`, `registered_email_2`, `registered_email`, `registered_city`, `registered_state`. Only the display layer is missing fields.

Update these three surfaces so the Registered / Corporate Office Address card consistently lists: Address Lines 1–4, City, State, PIN Code, Contact 1, Contact 2, Email 1, Email 2.

### 2a. `src/components/vendor/steps/ReviewStep.tsx` (Step 7 Review)
Inside the "Registered / Corporate Office Address" sub-card (around lines 137–150):
- Keep Address Lines 1–4, City, State, PIN Code.
- Replace the single `Phone` row with `Contact 1` (`data.address?.registeredContact1`) and `Contact 2` (`data.address?.registeredContact2`).
- Replace the single `Email` row with `Email 1` (`data.address?.registeredEmail`) and `Email 2` (`data.address?.registeredEmail2`).
- Keep the existing fallbacks to `ceoPhone`/`ceoEmail` only when the registered values are blank.

### 2b. `src/components/vendor/VendorReviewDialog.tsx` (Approval / Vendor Review dialog)
Inside the "Registered / Corporate Office Address" grid (around lines 520–533):
- Keep Address Lines 1–4, City, State, PIN Code.
- Add `Contact 1` → `(vendor as any).registered_contact_1`.
- Add `Contact 2` → `(vendor as any).registered_contact_2`.
- Add `Email 1` → `(vendor as any).registered_email || vendor.primary_email`.
- Add `Email 2` → `(vendor as any).registered_email_2`.
- Remove the now-redundant single `Phone` / `Email` rows (or keep them only as fallback labels — preference: replace them outright with Contact 1/2 and Email 1/2 to match the registration form vocabulary).

### 2c. `src/components/sap/SapFieldsDialog.tsx` (SAP Sync popup, read-only address block)
Inside the "Registered / Corporate Office Address" Section (around lines 160–170):
- Keep Address Lines 1–4, City, State, Pincode.
- Replace `Phone`/`Email` rows with:
  - `Contact 1` → `(vendor as any)?.registered_contact_1`
  - `Contact 2` → `(vendor as any)?.registered_contact_2`
  - `Email 1`   → `(vendor as any)?.registered_email || (vendor as any)?.primary_email`
  - `Email 2`   → `(vendor as any)?.registered_email_2`

## 3. Out of scope
- No DB schema changes (columns already exist).
- No edge-function changes.
- Communication Address sub-cards stay as-is.
- Step-1 verification, MSME upload, and other workflows are unchanged.

## 4. Verification
- Open Step 3 with a vendor whose stored `registeredAddress` is >40 chars → confirm Lines 2–4 are auto-filled on first paint and no validation error appears.
- Fill Contact 1/2 and Email 1/2 in Step 3, advance to Step 7 → confirm all four rows appear in the Registered card.
- Submit and open the Approval `VendorReviewDialog` → confirm the same four rows render with persisted values.
- Open SAP Sync popup for that vendor → confirm Contact 1, Contact 2, Email 1, Email 2 are all visible in the read-only Registered Address section.
