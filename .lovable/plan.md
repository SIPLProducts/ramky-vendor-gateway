## UI Design Settings — Sidebar & Per-Action Button Configuration

Extend the existing Design Settings tab with (1) full sidebar theming including selected-menu styling, and (2) per-action button styling that flows to every module. No business logic touched — presentation tokens only.

### 1. Sidebar card additions

Add missing controls to `sidebar` in `DesignSettings`:

- Selected Menu Background Color (already covered by `active` — relabel to "Selected Menu Background")
- **Selected Menu Border Color** (new — `selectedBorder`)
- **Selected Menu Text Color** (new — `selectedText`)
- Existing kept: Background, Text, Icon, Hover, Width

New CSS variables written from `applyDesignSettings`:
- `--sidebar-selected-border`, `--sidebar-selected-foreground`

Bridges in `src/index.css` target the shadcn sidebar active state:
```css
[data-sidebar="menu-button"][data-active="true"] {
  background: hsl(var(--sidebar-accent));
  color: var(--sidebar-selected-foreground, hsl(var(--sidebar-accent-foreground)));
  border-left: 3px solid var(--sidebar-selected-border, transparent);
}
```

### 2. Buttons card — per-action styling

Replace the single "Buttons" block with:

- **Global Buttons** (default fallback — the current fields stay as the baseline)
- **Action Buttons** — a repeatable grid of accordion rows, one per action:

  Approve, Reject, Preview, View Details, Add Config, Save, Update, Create, Search, Reset, Export Excel, Export PDF, Export CSV, Cancel, Clear, Sync, Duplicate & Close, Send to Vendor, Submit, Delete, Invite, Approve & Forward.

  Each row exposes: Background, Border, Text, Border Radius, Font Size, Hover.

Data shape added to `DesignSettings`:
```ts
actionButtons: Record<ActionKey, {
  background: string; text: string; border: string;
  borderRadius: string; fontSize: string; hover: string;
}>
```

`applyDesignSettings` emits scoped CSS variables per action:
```
--btn-approve-bg, --btn-approve-text, --btn-approve-border,
--btn-approve-radius, --btn-approve-font-size, --btn-approve-hover
… (same for every action key)
```

`src/index.css` adds one selector per action, matched by a `data-action` attribute:
```css
[data-action="approve"] {
  background: var(--btn-approve-bg) !important;
  color: var(--btn-approve-text) !important;
  border: 1px solid var(--btn-approve-border) !important;
  border-radius: var(--btn-approve-radius) !important;
  font-size: var(--btn-approve-font-size) !important;
}
[data-action="approve"]:hover { background: var(--btn-approve-hover) !important; }
```

### 3. Applying action styles across modules

To reach User Management, Vendor Invitations, Buyer Approval, All Vendors, Reports, Admin Configuration, KYC/SAP API Settings, Email Configuration, Dashboard, and approval screens without touching business logic, add a tiny presentation helper:

`src/lib/actionButton.ts`
```ts
export const actionProps = (action: ActionKey) => ({ 'data-action': action });
```

Then in each page's existing `<Button>` usages, add `{...actionProps('approve')}` (or the matching key). This is a pure prop addition — no handlers, state, or logic change. The change is mechanical and confined to JSX attributes on already-existing buttons.

Scope of files that receive the `data-action` prop (buttons already present, just tagged):
```text
src/pages/UserManagement.tsx
src/pages/AdminInvitations.tsx
src/pages/VendorList.tsx
src/pages/Reports.tsx
src/pages/AdminConfiguration.tsx
src/pages/KycApiSettings.tsx
src/pages/SapApiSettings.tsx
src/pages/EmailConfiguration.tsx
src/pages/Dashboard.tsx
src/pages/approvals/*.tsx
src/components/admin/*.tsx  (Save / Create / Update / Cancel / Reset / Add Config buttons)
src/components/vendor/VendorReviewDialog.tsx (Approve / Reject / Send to Vendor)
src/components/sap/*.tsx (Sync / Duplicate & Close / Preview)
```

### 4. Defaults from the current UI

`DEFAULT_DESIGN_SETTINGS.actionButtons` is seeded with the colors currently used in the app:
- Approve / Save / Create / Update / Submit → primary green `#1f9d6a`
- Reject / Delete / Clear → destructive `#dc2626`
- Preview / View Details / Sync / Export → info `#2f80ed` outline style
- Cancel / Reset → neutral outline `#6b7280`
- Send to Vendor / Invite → accent `#0ea5e9`

`useDesignSettings.mergeDeep` already backfills missing keys from defaults, so existing tenants pick these up automatically on first load — the panel shows the live current colors as editable defaults.

### 5. Files changed

- `src/lib/designTokens.ts` — extend `DesignSettings` (sidebar selected fields, `actionButtons` map, `ActionKey` union), extend `DEFAULT_DESIGN_SETTINGS`, extend `applyDesignSettings`, extend reset list.
- `src/components/admin/DesignSettingsPanel.tsx` — new sidebar fields, new "Action Buttons" accordion section with per-action rows.
- `src/index.css` — sidebar selected bridges + per-action `[data-action="…"]` bridges.
- `src/lib/actionButton.ts` — new tiny helper exporting `actionProps` and `ActionKey`.
- Mechanical prop-only edits across the page/component files listed above.

### Out of scope

No changes to auth, RLS, edge functions, DB schema, vendor workflow, validations, or any handler code. Purely visual tokens and JSX attribute tagging.
