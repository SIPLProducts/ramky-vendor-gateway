## Goal

Add an **eye (info) indicator** next to every built-in field in the Form Builder. When the admin clicks it, a small popover/tooltip explains:

- **What the field is for** (usage)
- **Why it matters** (importance — e.g. drives GST verification, blocks SAP transfer, used for compliance scoring, etc.)

This helps admins decide before they hide/edit a field.

## UX

In the right pane → "Built-in Fields" cards, each field row already shows:
`[icon]  Label  [type]  [Required]  [Verification]    Edit | Remove`

We add a new info button right after the badges:

```text
[icon] Label [type] [Required] [Verification] [ⓘ]    Edit | Remove
```

- Icon: `Info` (lucide) — small, muted, hover turns primary.
- Click opens a `Popover` (already used in the project via shadcn) anchored to the icon.
- Popover content (compact, ~280px wide):
  - Field title + `field_name` (mono)
  - **Usage** — 1–2 sentence plain-English description of what data is captured
  - **Why it matters** — bullet list (1–3 items): verification impact, downstream system (SAP / OCR / penny-drop), compliance/legal need, or "Display-only, safe to hide".
  - For `locked` (verification) fields: an amber callout "Hiding this disables {GST / PAN / Bank / MSME} verification."

No popover for custom fields (admin authored those themselves) — only built-in fields get the info button.

## Where the copy comes from

Extend the `BuiltInField` interface in `src/lib/builtInFields.ts` with two optional fields used purely for documentation:

```ts
interface BuiltInField {
  // ...existing
  usage?: string;        // 1–2 sentence description
  importance?: string[]; // bullet points; first item shown bold if locked
}
```

Then enrich the catalog. Existing `help_text` (vendor-facing hint) stays as-is — `usage`/`importance` are admin-facing and richer.

We'll seed sensible copy for every built-in field across the 5 tabs (Document Verification, Organization, Address, Contact, Financial). Examples:

- **gstin** → Usage: "15-character GST Identification Number issued by GSTN." Importance: ["Verified live against the GST portal — disables auto-fill of legal name & address if hidden", "Required by SAP master-data for tax computation", "Mandatory for B2B invoicing in India"].
- **bank_account_number** → Usage: "Vendor's payout bank account." Importance: ["Validated by ₹1 penny-drop to confirm beneficiary", "Used as payment account in SAP", "Required for any vendor payout"].
- **ceoEmail** → Usage: "Primary contact email of the CEO/MD." Importance: ["Receives onboarding & approval notifications", "Used as fallback authority contact"].
- **registeredPincode** → Usage: "PIN code of registered office." Importance: ["Determines GST place-of-supply", "Used in vendor geographic reports"].

For fields with no special verification/system role, we use generic phrasing like "Profile information shown on the vendor master record."

## Technical Changes

1. **`src/lib/builtInFields.ts`**
   - Add `usage?: string` and `importance?: string[]` to `BuiltInField`.
   - Populate for all ~120 built-in fields. Bulk fields (like turnover years, address lines, branch contacts) get short shared phrasing; verification/banking/legal fields get specific copy.

2. **`src/pages/FormBuilder.tsx`** (built-in field row, around lines 503–526)
   - Import `Popover, PopoverContent, PopoverTrigger` from `@/components/ui/popover` and `Info` from `lucide-react`.
   - Add `<Popover>` with a small ghost icon button after the badges row.
   - PopoverContent renders: label, field_name, "Usage" section, "Why it matters" bullet list, and an amber callout when `bf.locked`.
   - Keep button compact (`h-6 w-6`) and `aria-label="Field details"` for accessibility.

3. No DB / migration / hook changes — purely catalog + UI.

## Out of Scope

- Vendor-side help (`help_text` already handled).
- Per-tenant overrideable usage text.
- Editing usage/importance from the UI (it stays code-managed).
