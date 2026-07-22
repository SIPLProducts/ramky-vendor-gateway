## Goals
1. Make user-entered input values appear slightly bold across the app.
2. Convert all UPPERCASE table headers, card headers, dashboard labels, and field labels to Title Case (e.g. `REFERENCE NUMBER` → `Reference Number`).

---

## Part 1 — Bold input values (global CSS)

### `src/index.css`
Add one global rule so every form control shows entered values in medium weight (500), while placeholders stay normal.

```css
input, textarea, select,
[data-radix-select-trigger] {
  font-weight: 500;
}
input::placeholder,
textarea::placeholder {
  font-weight: 400;
}
```

No per-component edits needed.

---

## Part 2 — Title Case for headers and labels

### Approach
Most uppercase text in the app comes from either:
- Hardcoded `"REFERENCE NUMBER"`-style strings in JSX, or
- Tailwind `uppercase` utility applied to Title Case strings (e.g. `<TableHead className="uppercase">Reference Number</TableHead>`).

Strategy:
1. **Remove `uppercase` / `tracking-wider` / `text-xs uppercase` utility classes** from:
   - `TableHead` cells in every list/table (Vendors, Invitations, SAP Sync, Approvals, Dashboard tables, Duplicate details table, etc.)
   - `CardTitle` / `CardHeader` labels
   - Dashboard KPI card labels
   - Section headers inside vendor registration and admin screens
   - Filter/dropdown group headings
2. **Convert hardcoded ALL-CAPS strings** to Title Case in place.
3. Keep small stylistic caps only where they are true brand/acronym tokens (`GST`, `PAN`, `MSME`, `SAP`, `DMS`, `IFSC`, `TAN`, `CIN`, `QHSE`) — these stay uppercase.

### Files to update (non-exhaustive; will grep-verify before editing each)
- `src/pages/VendorList.tsx`
- `src/pages/AdminInvitations.tsx`
- `src/pages/SAPSync.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/SAPTeamDashboard.tsx`
- `src/pages/Approvals.tsx` / approval detail views
- `src/pages/UserManagement.tsx`
- `src/components/vendor/**` (labels inside registration steps, review, preview dialog)
- `src/components/**` shared table/card wrappers
- Any shared `DataTable` / column-def files

### Verification
- `rg -n "uppercase|tracking-wider|UPPER"` to confirm no styled uppercase headers remain in the targeted areas.
- `rg` for common all-caps strings (`REFERENCE`, `STATUS`, `VENDOR NAME`, `EMAIL`, `PHONE`, `ACTIONS`, `DATE`, `AMOUNT`) to catch stragglers.
- Typecheck + build.
- Spot-check screens: All Vendors, Dashboard, Invitations, SAP Sync (incl. new Duplicate Details table), Approvals, Vendor Registration Review/Preview.

## Out of scope
- Acronyms remain uppercase (GST, PAN, MSME, SAP, DMS, IFSC, TAN, CIN, QHSE, HSN, SAC, UAM, IEC).
- Button copy, toast messages, and body text are unchanged unless they are labels/headers of the types listed.
- Backend/email templates — unchanged.
