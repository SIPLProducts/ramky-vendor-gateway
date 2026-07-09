
## Changes in `src/components/vendor/VendorReviewDialog.tsx`

### 1. Rename & trim "Routing & Invitation" → "Buyer Details"
- Change section heading to "Buyer Details".
- Keep only two fields in the grid (2 columns):
  - **Buyer Company** — from `routing.vendorCompany`
  - **Invited By (Buyer)** — from `routing.buyerName` (+ email sub-line)
- Remove "Invitation Company" (including mismatch warning) and "Mapped SCM CO(s)".

### 2. Restructure Statutory Details card
- Change grid from `grid-cols-3` to `grid-cols-4`.
- Reorder fields into a single logical flow (4 per row):
  - Row 1: GSTIN, PAN, PAN Holder Name, PAN Status
  - Row 2: Is Aadhaar Linked, MSME Number, MSME Category, Firm Registration No
  - Row 3: IEC No
- Add a small green check icon (`CheckCircle2` from lucide-react, `text-emerald-600`) inline beside the label when that field's validation passed:
  - GSTIN → `vendor.gst_verification_status === 'passed'`
  - PAN, PAN Holder Name, PAN Status, Is Aadhaar Linked → `vendor.pan_verification_status === 'passed'`
  - MSME Number, MSME Category → `vendor.msme_verification_status === 'passed'`
- No separate status text — just the tick icon beside verified fields.

### 3. Remove the "Validations" tab
- Change `TabsList` from `grid-cols-4` to `grid-cols-3`.
- Delete `<TabsTrigger value="validations">` and its corresponding `<TabsContent value="validations">` block (which renders `<ValidationStatus>`).
- Remove now-unused `ValidationStatus` import and `validations` local variable.

No other files or business logic touched.
