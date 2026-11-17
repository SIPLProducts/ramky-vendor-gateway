# User Audit Report PDF: Ramky Logo and Brand Colours

## Change
- Put the **Ramky Group logo** at the top left of the PDF's first page, on a white header band.
- Show the title "User Audit Report", the user name and the generated date to the right of the logo.
- Add a thin three-colour strip under the header in the logo colours: Ramky blue, orange and green.
- Restyle the PDF with Ramky colours:
  - Summary and table headers: Ramky blue (#005BA1) with white text
  - Section titles: blue, with an orange underline accent
  - Row tints by action: Approved light green (#00A13A tint), Pending light orange (#E87817 tint), Rejected light red, Returned light amber, Invited light blue (#2FB4EA tint)
  - Footer: "Ramky Group · Vyapaar Portal" on the left and "Page X of Y" on the right, above a thin blue line
- The repeated table headers on later pages also use Ramky blue.

## Technical details
- `src/components/user-audit/exportUserAuditPdf.ts` only.
- Import the existing `src/assets/ramky-logo.png` as a URL. Load it into an `Image`, convert it to a data URL, then `doc.addImage(...)` (about 70×64 pt, aspect kept). The export function becomes async; the page awaits it.
- Brand palette constants: blue `[0,91,161]`, orange `[232,120,23]`, green `[0,161,58]`, sky `[47,180,234]`.
- If the logo fails to load, the PDF still downloads without it.

## Also: on-screen table and Excel in the same Ramky look
The user card style from the screenshot (soft gradient, coloured left border, round icon) becomes the reference look.

**On-screen table**
- Header row: Ramky blue gradient with white bold text.
- Rows: alternating white and very light blue, with the coloured left border by action kept (green Approved, orange Pending, red Rejected, amber Returned, sky blue Invited).
- Action pills and status badges use the Ramky palette with stronger contrast so they read clearly.
- The selected user's card gets a Ramky blue-to-green gradient border accent.

**Excel download**
- Styled sheets: Ramky logo-coloured title row ("Ramky Group – User Audit Report", user name, date), blue header row with white bold text, frozen header, borders, auto column widths.
- "All Records" sheet rows are tinted by action, using the same colours as the PDF.
- Summary sheet: label column in light blue, values bold.

## Technical details (additions)
- Swap `xlsx` for `xlsx-js-style` (a drop-in fork that supports cell styles) in `exportUserAudit.ts` only.
- Table styling in `src/pages/UserAuditReport.tsx` uses theme tokens (primary/success/warning/destructive); no hardcoded colours.
