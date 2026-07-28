## Goal

Give the "Vendor Details" tables a clearer, more attractive visual identity so users can distinguish two scenarios at a glance:

- **Duplicate vendor already in SAP** → warm amber/red warning theme (like screenshot 2, but slightly richer)
- **Vendor successfully created in SAP** → green success theme

Same visual language in both the SAP Sync screen (in-app) and the buyer notification emails, so the UI and the email match.

## Scope (visual only, no logic changes)

### 1. In-app — `src/pages/SAPSync.tsx`

**a. Duplicate & Closed card — "Existing Vendor Details (from SAP)" table** (around lines 768–810)
- Header bar: gradient `from-amber-100 to-red-100`, amber-800 title, small ⚠ warning icon, subtitle "Vendor already exists in SAP".
- Table body: alternating amber-50 / white rows, amber-200 borders, amber-900 labels, mono value column.
- Rounded-xl outer container with a soft amber ring/shadow so it visually separates from the red "Duplicate & Close Remarks" block below.

**b. Single-vendor SAP Sync Result dialog** (lines 980–1019)
- Success case (`success !== false`, MSGTYP === 'S'): render a new **green "Vendor Details (Created in SAP)"** card — emerald header, ✓ success icon, table of SAP Vendor Code, Business Partner Name, Reference No, message — replacing the plain `bg-muted` row.
- Error case with duplicate row: reuse the same amber/red "Existing Vendor Details" table component (parse `MSG_TEXT` the same way the closed card does).
- Non-duplicate errors keep the current muted styling.

**c. Bulk SAP Sync Result dialog** (lines 1022–1064)
- Per row: successful rows get the same green mini-table treatment; failed rows keep destructive badge; duplicate rows (detected via existing `isPanDuplicateResponse` helper) get the amber mini-table.

### 2. Emails

**a. `supabase/functions/sap-team-reject-vendor/index.ts` — duplicate close email**
- Restyle the existing `existingBlock` (lines 156–177) to match screenshot 2's aesthetic but with a warmer palette:
  - Amber header bar (`background:#fef3c7; color:#92400e; border:1px solid #fcd34d`) with ⚠ icon and title "Existing Vendor Details".
  - Rows: alternating `#fffbeb` / `#ffffff`, amber-200 borders, `#78350f` label color, monospace value column.
- Rest of email (Reason / Remarks / Closed Date table) unchanged.

**b. `supabase/functions/sync-vendor-to-sap/index.ts` — success email** (lines 874–888)
- Wrap the vendor details table in a green success theme:
  - Green header bar (`background:#dcfce7; color:#166534; border:1px solid #86efac`) with ✓ icon and title "Vendor Details — Successfully Created in SAP".
  - Rows: alternating `#f0fdf4` / `#ffffff`, green-200 borders.
- Keep all fields (Legal Name, Trade Name, Buyer Company, SAP Vendor Code, Reference No, Synced At).

## Out of scope

- No changes to parsing (`isPanDuplicateResponse`), DB writes, `sap_duplicate_details` shape, migrations, RLS.
- No changes to DMS Sync Result dialog styling.
- No changes to bulk success email (there isn't one today).

## Verify

1. Trigger a duplicate SAP sync (`AACFU0481F`) → Duplicate & Closed card shows the amber-themed Existing Vendor Details table; buyer email shows the same amber-themed block above the Reason row.
2. Trigger a successful SAP sync → Result dialog shows a green Vendor Details card with SAP Vendor Code + BP name; buyer email uses the green-themed Vendor Details table.
3. Trigger a non-duplicate SAP error → dialog keeps current muted red styling (no accidental green/amber tint).
4. Bulk sync with mixed rows → each row uses the correct theme (green success / amber duplicate / red generic error).
