## Scope
File: `src/components/vendor/VendorReviewDialog.tsx` (used by SCM Manager, SCM Head, Finance 1, Finance 2, CEO, and SAP Sync review flows).

## Changes

### 1. Rename dialog subtitle everywhere
- Line 143 comment: update JSDoc default to `"Review vendor details"`.
- Line 194: change default prop value from `'Review vendor details before syncing to SAP'` to `'Review vendor details'`.

Since every approval screen (SCM Manager, SCM Head, Finance 1/2, CEO, SAP Sync) uses this shared dialog's default `description`, one change updates all of them.

### 2. All Details tab — every card to 3 columns
Update grid layouts inside the "Details" tab to `grid-cols-3`:

- **Buyer Details** (line 452): `grid-cols-2` → `grid-cols-3`
- **Organization Details** (line 478): `grid-cols-2` → `grid-cols-3`
- **Address Details**
  - Registered / Corporate Office Address (line 500): `grid-cols-2` → `grid-cols-3`
  - Communication Address (line 524): `grid-cols-2` → `grid-cols-3`
- **Contact Details** (line 543): `grid-cols-2` → `grid-cols-3`
- **Statutory Details** (line 580): `grid-cols-4` → `grid-cols-3`
- **Bank Details** (line 603): already `grid-cols-3` — leave as is
- **Classification Details** (line 625): outer wrapper stays `md:grid-cols-2` (two labeled sub-cards side-by-side); no change needed
- **Financial Information** (line 663): already `grid-cols-3` — leave as is

No changes to business logic, data fetching, tab structure, or other files.
