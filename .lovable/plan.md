## Changes to `src/components/vendor/VendorReviewDialog.tsx`

### 1. Address Details card → visiting-card format
Replace the current field-grid layout with a two-column visiting-card layout (Registered / Corporate Office + Communication):
- Rounded card, subtle gradient background, thin primary accent bar on the left, MapPin icon top-right.
- Address rendered as a formatted `<address>` block (line-by-line):
  - Address Line 1
  - Address Line 2 (Lines 3 & 4 also included if present)
  - City, State
  - PIN <pincode>
- District / Country omitted (not stored today, per your choice).
- Office Phone and Fax removed.
- Email 1, Email 2, Contact 1, Contact 2 kept, shown inside the same card in a compact 2-column key/value grid below a divider.
- Communication Address uses the same card style. When it equals the registered address it shows "Same as Registered Address" italic.

### 2. Statutory Details — clearer, more beautiful verified tick
Replace the tiny inline `CheckCircle2` with a solid emerald pill badge:
- 16 px round badge, `bg-emerald-500`, white check icon (stroke 3), subtle ring + shadow.
- Sits right next to the field label (GSTIN, PAN, PAN Holder Name, PAN Status, Aadhaar Linked, MSME Number, MSME Category) whenever that verification passed.
- `title` / `aria-label` = "Verified" for accessibility.

### 3. No other cards, order, or logic changes
Card order stays: Buyer Details → Organization Details → Statutory Details → Bank Details → Address Details → Classification Details → Financial Information.

No schema/migration changes. No changes to other files.