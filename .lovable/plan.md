## Change

**`src/components/vendor/steps/international/IntlCompanyDetailsStep.tsx`** — restyle required-field markers and tighten layout.

### 1. Red asterisks on required labels
Replace the inline `*` inside each required label text with an explicit `<span className="text-destructive ml-0.5">*</span>` so the asterisk renders red (matching `DynamicStep.tsx`). Apply to:
- Company Name
- Pincode / Postal Code
- Country (From SAP)
- Region
- Company Contact 1
- Company Email 1

Optional fields (Company Address, Contact 2, Email 2) keep no asterisk.

### 2. Row/column layout for the required fields
Reorganize the grid so the six required fields appear in compact rows of columns instead of full-width stacks:

```text
Row A:  [ Company Name ]              [ Pincode / Postal Code ]
Row B:  [ Country (From SAP) ]        [ Region ]
Row C:  [ Company Contact 1 ]         [ Company Email 1 ]
Row D:  [ Company Address (full width, optional) ]
Row E:  [ Contact 2 ]                 [ Email 2 ]
```

Implementation: wrap each pair in `grid md:grid-cols-2 gap-5`. Company Address stays full-width on its own row. The existing 3-column row (Pincode / Country / Region) is split as above so required fields are paired cleanly.

### Out of scope
No validation, schema, or other step changes.
