## Goal

After the OCR + validation API chain runs (GST and Bank), show a green tick and a small confirmation message **directly under each individual field** in the verified panel — e.g. "GSTIN is verified", "Legal Name matches registry", "Account Number is verified" — driven by comparing the captured/edited value against the validation API response.

This adds field-level proof on top of the existing top-level success banner, exactly as shown in the reference screenshot (Identity, Registration sections of the GST verified panel).

## Scope

1. **GST verified panel** (`GstVerifiedDetails` in `src/components/vendor/steps/DocumentVerificationStep.tsx`) — Identity + Registration + Place of Business + Jurisdiction sections.
2. **Bank verified panel** (the bank `verifiedFields` block in the same file) — Account Number, IFSC, Bank Name, Branch, Account Holder Name.

No backend / edge-function / DB changes are needed — the data already arrives via the existing `GST` and `BANK` validation API responses.

## How it will work

### 1. Pass the API response down to the verified panels

Both panels already have the validation API result available in state:
- GST: `gstDoc.apiData` (registry response merged into `ocrData` after verification).
- Bank: `bankDoc.apiData` (penny-drop response).

We will pass `apiData` (the registry/penny-drop response) as a new `verifiedApi?: Record<string, any>` prop into `GstVerifiedDetails` and into the bank `verifiedFields` JSX.

### 2. New `EditableOcrField` "verified" affordance

Extend `EditableOcrField` with two optional props:
- `verifiedValue?: string` — the value returned by the validation API for this field.
- `verifiedLabel?: string` — short label shown next to the tick (e.g. "GSTIN is verified", "matches registry").

Behavior:
- If `verifiedValue` is present and `normalize(current) === normalize(verifiedValue)` → show a green check icon + small green text **below the input** ("✓ <label>").
- If `verifiedValue` is present but does not match → show a small amber warning row ("⚠ Doesn't match registry value: <verifiedValue>") with a one-click "Use registry value" button that calls `onChange(verifiedValue)`.
- If `verifiedValue` is missing → render nothing extra (today's behavior).

Normalization: trim, uppercase, collapse whitespace; for dates compare ISO `YYYY-MM-DD` form.

### 3. Wire each field

**GST panel — `GstVerifiedDetails`** (Identity + Registration):

| UI Field            | Compared against API field                        | Verified label              |
|---------------------|---------------------------------------------------|-----------------------------|
| Legal Name          | `legal_name` / `business_name`                    | "Legal Name is verified"    |
| Trade Name          | `trade_name`                                      | "Trade Name is verified"    |
| GSTIN               | `gstin`                                           | "GSTIN is verified"         |
| Constitution        | `constitution_of_business`                        | "Verified from registry"    |
| GST Status pill     | `gstin_status` (already shown via `GstStatusPill`)| Add tick + "Active per registry" beside the pill when the API status is `Active` |
| Registration Date   | `date_of_registration`                            | "Verified from registry"    |
| Taxpayer Type       | `taxpayer_type`                                   | "Verified from registry"    |
| Centre Jurisdiction | `center_jurisdiction`                             | "Verified from registry"    |
| State Jurisdiction  | `state_jurisdiction`                              | "Verified from registry"    |
| Principal Place     | `address`                                         | "Matches registry address"  |

**Bank panel** (`bankDoc.apiData` from the `BANK` provider):

| UI Field             | Compared against API field        | Verified label                   |
|----------------------|------------------------------------|----------------------------------|
| Account Number       | `account_number`                  | "Account Number is verified"     |
| IFSC Code            | `ifsc` / `ifsc_details.ifsc`      | "IFSC is verified"               |
| Bank Name            | `ifsc_details.bank_name` / `bank_name` | "Bank Name is verified"     |
| Branch               | `ifsc_details.branch` / `branch_name`  | "Branch is verified"        |
| Account Holder Name  | `full_name` / `name_at_bank`      | "Name matches bank record"       |

The existing top-level success banner stays — these are field-level confirmations that match the screenshot the user shared.

### 4. Behavior on user edit

If the user edits an already-verified field so it diverges from the registry value, the green tick disappears and the amber mismatch helper appears, offering "Use registry value". This keeps it honest — only true matches show the tick.

## Visual style

- Tick: existing `CheckCircle2` icon, `text-success` token.
- Helper text: 11px, `text-success` for verified, `text-warning` for mismatch.
- Placement: directly under the input, left-aligned, no extra spacing on idle fields.

## Files to change

- `src/components/vendor/steps/DocumentVerificationStep.tsx`
  - Extend `EditableOcrField` with `verifiedValue` / `verifiedLabel` props + render logic.
  - Pass `verifiedApi` into `GstVerifiedDetails` and wire each field.
  - Wire each bank `EditableOcrField` with the corresponding registry value.
  - Add a small "Active per registry" tick next to the existing `GstStatusPill` when the API confirms status.

No new files, no DB migrations, no edge function changes.

## Out of scope

- Changing the OCR or validation API contracts.
- Reworking the top-level success/failure banner (kept as-is).
- The "Are you GST registered? = No" self-declaration branch (no API to verify against).
