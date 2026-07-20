## 1) Verified OCR field — keep messages below input, change border to bottom-only

File: `src/components/vendor/steps/DocumentVerificationStep.tsx` (`EditableOcrField`, ~lines 3768–3881)

- **Keep all existing messages below the input** — including the "Doesn't match registry value … Use registry value" line and any other helper/success text. No text is removed.
- Change only the `Input` container styling so the field renders as a **single bottom border** (no top / left / right border, no rounded rectangle, no background fill):
  - Base: `border-0 border-b rounded-none bg-transparent border-border/60 focus-visible:ring-0 focus-visible:ring-offset-0 px-0`
  - `matchesApi` (verified): `border-b-2 border-b-success` (dark green)
  - `mismatchApi`: `border-b-2 border-b-warning` (orange)
  - `isEdited`: `border-b-2 border-b-warning`
- Keep the right-aligned adornment cluster (green `BadgeCheck` / orange `AlertTriangle` / (i) popover) inside the input; reposition to `right-0` since horizontal padding is now 0.
- No changes to props, callers, verification logic, tooltip strings, or below-input helper text.

## 2) Organization Profile — hide Buyer Company, 2-column layout, drop Firm Registration No.

File: `src/components/vendor/steps/OrganizationStep.tsx`

- **Hide Buyer Company** (lines 318–358): remove the visible block but keep the hidden `<input type="hidden">` inside the Controller so `buyerCompanyId` still submits and validation still passes.
- **Two-column layout** for the Organization Profile section (lines 317–478): wrap Legal Name, Trade Name, Industry Type, Organization Type, Ownership Type, and State in a single `grid md:grid-cols-2 gap-5` container so every field sits in a 2-column row.
- **Remove Firm Registration No.** field (lines 530–539) from Statutory & Registrations, including its wrapping `md:grid-cols-2` row. `firmRegistrationNo` stays in the form schema — just not rendered.

## 3) Memberships & Certifications — hide Memberships and Enlistment With

File: `src/components/vendor/steps/OrganizationStep.tsx` (lines 558–612)

- Remove the `Memberships` block (lines 566–580) and the `Enlistment With` block (lines 581–595). Keep the section header and the `Certifications` block. `memberships` / `enlistments` form fields stay in state — no schema changes.

## Verification

- Build passes.
- Vendor Registration → Organization Profile: no Buyer Company row, fields 2 per row, no Firm Registration No., only Certifications under Memberships & Certifications.
- Documents tab (GST / PAN / MSME / Bank verified panels): inputs show only a bottom border — dark green when matched, orange when mismatch/edited — with all existing helper messages still shown below.
