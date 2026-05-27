## Point 1 — Remove "Accounting Group" from Organization Profile

Vendor type (Domestic / International) is already selected at the very start of registration. We derive the accounting group from that selection so the user doesn't enter it again.

**`src/components/vendor/steps/OrganizationStep.tsx`**
- Remove the entire `Accounting Group *` `<div>` (lines 435–456).
- Schema change: make `accountingGroup` optional (`z.enum([...]).optional()`), remove the required error.
- In the form's `onSubmit` / persistence handlers (lines ~178 and ~219), auto-set:
  `accountingGroup: vendorType === 'international' ? 'Import' : 'Domestic'`
- Drop the now-unused `ACCOUNTING_GROUPS` import if nothing else uses it.

**`src/components/vendor/steps/ReviewStep.tsx`**
- Remove the `<DataRow label="Accounting Group" .../>` (line 135). It's implied by the vendor type chosen in step 1.

No DB change — the column still stores "Domestic" / "Import" automatically.

## Point 2 — Remove unused Statutory & Registrations fields

**`src/components/vendor/steps/OrganizationStep.tsx`** — inside the "Statutory & Registrations" section, remove:
1. The entire `Entity Type *` `<div>` (lines 471–492) and the wrapper `grid md:grid-cols-2` it shares with Firm Registration No. — keep Firm Registration No. on its own row.
2. The whole `grid md:grid-cols-2` block with **IEC No.** + **SWIFT / IBAN Code** (lines 518–531).
3. The whole `grid md:grid-cols-2` block with **IEC Certificate** + **SWIFT / IBAN Proof** FileUploads (lines 533–552).
4. The whole `grid md:grid-cols-2` block with **Operational Network** select (lines 554–574).

Schema cleanup in the same file:
- Mark `entityType`, `iecNo`, `swiftIbanCode`, `operationalNetwork` as `.optional()` so existing data still parses but they are no longer required and no longer rendered.
- Remove unused imports if any (`ENTITY_TYPES`, `OPERATIONAL_NETWORKS`) once references are gone.

**`src/components/vendor/steps/ReviewStep.tsx`**
- In the "PAN & Entity Type" card (lines 160–166): rename title to **"PAN"**, remove the `Entity Type` `DataRow`. Edit target stays `step 1, tab 'pan'`.

International flow (`IntlClassificationStep`, intl statutory) is **not touched** — Entity Type / IEC / SWIFT belong there contextually only if intl uses them, which it doesn't here.

## Point 3 — Review & Submit "Edit" navigates to the right card/tab

The deep-link wiring (`onEditStep(step, tab)` → `setPendingDocTab` → `DocumentVerificationStep.initialTab`) is already in place from the previous change. Verify and adjust per-section targets so each card edits the right place:

**`src/components/vendor/steps/ReviewStep.tsx`** — keep current targets:
- Organization Details → step 2
- Address Information → step 3
- Contact Information → step 4
- PAN → step 1, tab `pan`
- GST Details → step 1, tab `gst`
- MSME Details → step 1, tab `msme`
- Bank Details → step 1, tab `bank`
- Financial Information → step 5

**`src/pages/VendorRegistration.tsx`** — confirm `handleEditStep(step, tab)` calls both `setPendingDocTab(tab)` and `setCurrentStep(step)` (already done), and that `DocumentVerificationStep` receives `initialTab={pendingDocTab}` (already done). No further code change unless verification turns up a bug.

## Out of scope / unaffected
- International flow, SAP Sync screen, classification, edge functions, middleware, DB schema.
- All other tabs, CEO field rules, template-download label, validation logic.

## Files to edit
1. `src/components/vendor/steps/OrganizationStep.tsx` — remove Accounting Group, Entity Type, IEC No, SWIFT/IBAN Code, IEC Certificate, SWIFT/IBAN Proof, Operational Network; auto-derive `accountingGroup` from vendor type; relax schema.
2. `src/components/vendor/steps/ReviewStep.tsx` — drop Accounting Group row, drop Entity Type row, rename card to "PAN".
3. (Verification only) `src/pages/VendorRegistration.tsx` — confirm edit deep-link still works; no functional change expected.
