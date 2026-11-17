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
