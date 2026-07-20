## Contact Details tab — full 3-column row layout

Right now `src/components/vendor/steps/AddressStep.tsx` already uses `md:grid-cols-3` grids, but many rows contain only 1 or 2 fields, so the tab visually renders as 2 columns with big gaps (see screenshot: Office Phone + Fax, Website + Email 1, Contact 1 + Contact 2, Email 2 alone, Branch Name + Website, etc.). The fix is to regroup fields so every row is a proper triplet — no layout wrappers or logic changes.

### Regrouping (Registered / Corporate Office Address)
- Row 1: Address Line 1*, Address Line 2, Address Line 3
- Row 2: Address Line 4, City*, State*
- Row 3: PIN Code*, Office Phone, Fax
- Row 4: Website, Email 1*, Email 2
- Row 5: Contact 1*, Contact 2 (last slot empty)

The helper text "Text beyond 40 characters automatically flows into Address Line 2, 3 and 4" stays under Address Line 1 inside its cell.

### Regrouping (Manufacturing Unit — only when "Same as registered" is off)
- Row 1: Address Line 1, Address Line 2, Address Line 3
- Row 2: Address Line 4, City, State
- Row 3: PIN Code, Office Phone, Fax
- Row 4: Email ID (single field in row)

### Regrouping (Branch Details)
- Row 1: Branch Name, Website, Email ID
- Row 2: Address Line 1, Address Line 2, Address Line 3
- Row 3: Address Line 4, City, State
- Row 4: PIN Code, Country (last slot empty)
- Branch Contact Person subsection:
  - Row 1: Name, Designation, Email
  - Row 2: Phone, Fax (last slot empty)

### Preserved as-is
- All validations, `react-hook-form` bindings, `data-required` markers, error messages.
- Section cards, titles, the "Same as registered office address" checkbox.
- The `vendor-styled-form` bottom-border styling (green filled / orange required-empty).
- `md:grid-cols-3 gap-5` spacing — desktop 3-up, single column on mobile via the existing responsive prefix.

### Out of scope
- The old Contact Details tab (already hidden).
- Organization Profile, Financial & Infrastructure, Document Verification tabs.
- Field additions, removals, relabels, or validation edits.
