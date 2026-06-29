## Reports — split sections, professional layout, fix date picker

### 1. Restructure Reports page (`src/pages/Reports.tsx`)

Replace the current Tabs (Vendor Report / Approval Flow Report) with two clearly separated sections that render together for the chosen mode. The Tabs control is removed — both reports always render so the user can review vendor data and approval history side-by-side, with anchor links at the top ("Vendor Details", "Approval Flow") for quick scroll.

**Single Vendor mode** (already mostly built — polish only):
- Reorder/rename section cards to match the requested grouping exactly:
  1. Organization Details (legal name, trade name, type, category, sub-category, incorporation date, website, CIN)
  2. PAN Details (PAN, PAN holder name, PAN verification status from `vendor_validations`)
  3. GST Details (GSTIN, GST registration type, place of supply, GST verification status)
  4. MSME Details (is_msme_registered, msme_number, msme_category, MSME verification status)
  5. Bank Details (bank name, branch, IFSC, account #, account type, beneficiary, penny-drop result)
  6. Registered / Corporate Office Address
  7. Communication Address
  8. Contact Details (primary / finance / technical)
  9. Classification Details (vendor_category, vendor_sub_category, business_type, any classification fields present on `vendors`)
  10. Tax & Compliance
  11. International Details (only when international)
  12. Uploaded Documents — card with table of `vendor_documents` (type, file name, uploaded date, download link via signed URL from the existing `vendor-documents` bucket)
- Each card uses a coloured header strip + icon (lucide) for a clean modern look (Building2, FileText, Landmark, MapPin, Users, FolderOpen, ShieldCheck etc.)
- Empty sections are hidden so domestic vendors don't see empty international card.

**Approval Flow section** (rendered after vendor details in single-vendor mode, and as the main table in all-vendors mode):
- Single vendor: a vertical timeline-style card listing all 7 stages (Buyer → SAP Team) with Approver Name, Status badge, Approval Date & Time, Remarks. Approved stages show the green check + the recorded `acted_at`. Pending stage is highlighted as "Current Stage". Skipped stages render as muted `—` row.
- All vendors: keep the existing wide matrix table but tidy spacing, sticky first two columns, and add a "Current Stage" column before "Final".

**All Vendors — Vendor Report table:**
- Keep current summary table but add a "View Details" action per row that switches into single-vendor mode for that reference number (reuses the same detail layout).

### 2. Fix the date picker in All Vendors mode

The Popover currently sits inside a Card that has `overflow-x-auto` further down and the page wrapper restricts width; the Calendar's `selected` handler also receives `Date | undefined` while `setFromDate` works, but on certain viewports the Popover closes before the day click registers because the trigger Button is inside a `<form>`-like flow without `type="button"`.

Fixes applied to both From/To pickers:
- Add `type="button"` to the trigger `<Button>` so a stray Enter / click doesn't submit and dismiss.
- Add `modal={true}` to `<Popover>` so the calendar is portaled above and click-outside is handled correctly.
- Ensure `<PopoverContent>` has `z-50 bg-popover` (defaults already set) and add `sideOffset={8}`.
- Wrap `onSelect` to coerce: `onSelect={(d) => setFromDate(d ?? undefined)}` and add `disabled={(date) => toDate ? date > toDate : false}` for From, mirrored for To, so the range stays valid.
- Verify by opening the preview, picking a From date, then a To date, and confirm both display in the trigger and Run Report uses them.

### 3. Data loader tweak (`src/lib/reports/loadVendorReport.ts`)

- For single-vendor mode also surface a `signed_url` per document by calling `supabase.storage.from('vendor-documents').createSignedUrl(file_path, 3600)` in parallel, so the Documents card can render a working "Download" link. No schema change.
- No change to approval-flow logic.

### 4. Exports

No structural change — existing Excel/PDF exporters already emit Vendor Details, Documents, Validations and an Approval Flow sheet. Only label tweaks if any new field is added.

### Files

Edit only:
- `src/pages/Reports.tsx` — remove Tabs, render Vendor Details cards + Approval Flow timeline together, fix date pickers, add View-Details action on all-vendors table.
- `src/lib/reports/loadVendorReport.ts` — generate signed URLs for documents in single-vendor mode.

Out of scope: DB schema, RLS, approval-matrix logic, registration pages, SAP sync.
