## Reports screen — complete data, working date picker, inline display

### 1. Replace date picker with Dashboard-style inputs (`src/pages/Reports.tsx`)
Drop the `Popover` + `Calendar mode="range"` block (which is the one still misbehaving) and replace it with the same pattern Dashboard uses:

- Two native `<Input type="date">` controls labeled **From** and **To**, side-by-side.
- State stored as `Date | null` (`dateFrom`, `dateTo`), defaulting to last 30 days like Dashboard, with `startOfDay` / `endOfDay` normalization.
- Auto-correct when From > To (mirror Dashboard's `setDateTo` / `setDateFrom` guards).
- Pass `dateFrom.toISOString()` / `dateTo.toISOString()` to `loadVendorReports`.
- Remove `Calendar`, `Popover*`, `react-day-picker`, and the `DateRange` import from this file.

### 2. Keep Run Report on the same screen
Already inline — confirm and tighten: keep `viewVendor` (single-vendor drill-down) on the same route via state only (no `navigate()` calls), and keep the "Back to all vendors" button. No router navigation is introduced anywhere in the Run / View flow.

### 3. Excel + PDF download buttons
Already present in the filter card. Move/duplicate them into a second toolbar that **also shows when a single vendor is open** (currently the filter card hides in single mode, so exports disappear). Add a small toolbar at the top of the single-vendor view with **Excel** and **PDF** buttons that call the existing `exportVendorExcel` / `exportVendorPdf` with the current single row.

### 4. Show ALL captured vendor fields, grouped into cards

The `vendors` table has ~192 columns. Hard-coding a short whitelist (current behavior) is why fields are missing. New approach in `src/pages/Reports.tsx` (single-vendor view only):

- Define ordered **section groups** by column-name prefix / keyword. For each group, list known labels first, then auto-append any remaining matching columns from `row.details` with a humanized label (`snake_case → Title Case`).
- Always skip empty (`null` / `''` / `[]`) values and internal columns (`id`, `tenant_id`, `user_id`, `created_at`, `updated_at`, `*_token`, `metadata`, raw JSON dumps already shown elsewhere).
- Group definitions:
  - **Organization Details** — `legal_name`, `trade_name`, `vendor_type`, `business_type`, `cin`, `incorporation_date`, `website`, `industry*`, `establishment*`, plus any other org-level scalars.
  - **PAN Details** — every column matching `^pan` (number, holder name, verification status, verified_at, raw response flags, etc.).
  - **GST Details** (renamed heading) — every column matching `gst` (gstin, legal_name_as_per_gst, trade_name_as_per_gst, gst_status, gst_registration_type, place_of_supply, gst_filing_status, gst_verified_at, etc.).
  - **MSME Details** — every column matching `msme` / `udyam` (registered flag, number, category, enterprise type, date, verified flag, etc.).
  - **Bank Details** — every column matching `bank|account|ifsc|branch|upi|penny`, including `account_holder_name`, `bank_name`, `account_number`, `account_type`, `ifsc_code`, `branch_name`, `branch_address`, penny-drop verification fields.
  - **Registered / Corporate Office Address** — `registered_*`, `corporate_*`, `address*`, `city`, `state`, `pincode`, `country` (split into two cards if both registered and corporate prefixes exist).
  - **Contact Details** — `primary_*`, `contact_*`, `phone*`, `email*`, `alternate_*`, `designation`.
  - **Classification Details** — `classification*`, `category*`, `subcategory*`, `vendor_category`, `payment_terms`, `currency`, `tax_*` that isn't covered above.
  - **International Details** (international vendors only) — `tax_residency*`, `swift*`, `iban*`, `country_of_*`, `lut*`, `dtaa*`.
  - **Other Details** — auto-fallback card for any remaining non-empty `row.details` columns that didn't match a group, so nothing captured is dropped.
- Each card uses the existing `Card` + 2-column grid layout, with the icon already imported. Heading for GST card explicitly reads **"GST Details"**.

### 5. Documents card
Already lists `row.documents` with signed-URL "Open" buttons — keep. Confirm every uploaded doc renders (no filtering by type) and show `document_type`, `file_name`, uploaded date, and an Open link.

### 6. Out of scope
- No DB / RLS / migration changes.
- No changes to approval-flow logic or `loadVendorReport.ts` (it already returns full `row.details = v`).
- No changes to exporters' internal layout beyond passing the single row through.

### Files touched
- `src/pages/Reports.tsx` (date picker swap, exports toolbar in single view, dynamic field grouping for single vendor).

### Technical notes
- Humanize helper: `key.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())`.
- Group matcher runs once per render over `Object.entries(row.details)` with a `Set` of already-consumed keys to guarantee each field appears in exactly one card; leftovers go to **Other Details**.
- Date inputs use `value={date ? format(date,'yyyy-MM-dd') : ''}` and `onChange={e => setDate(e.target.value ? startOfDay(new Date(e.target.value)) : null)}`, identical to Dashboard.
