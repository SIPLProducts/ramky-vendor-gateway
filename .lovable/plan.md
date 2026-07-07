
# UI Modernization Plan

Goal: refresh the visual layer to match the reference (clean enterprise look — dark teal sidebar with brand badge, light slate canvas, crisp white cards, emerald primary actions, tidy tables and page titles). Zero changes to business logic, APIs, routes, validations, workflows, or the Vendor Registration flow/UI.

## Scope (visual only)

1. **Design tokens (`src/index.css`, `tailwind.config.ts`)**
   - Keep the already-applied dark‑teal sidebar tokens.
   - Tune primary/accent to the reference emerald (`--primary` ≈ `160 70% 38%`, hover `160 70% 33%`) used for Approve / Save / Add buttons.
   - Card token: pure white, `--radius: 12px`, refined `--shadow-card` (soft, low‑spread) for the "floating panel" look.
   - Standardize spacing scale usage: page padding `px-6 lg:px-10 py-8`, card padding `p-6`, section gap `gap-6`.
   - Add semantic status token pairs (success/warning/danger/info) for pill badges (Active, Idle, Pending, Rejected, Approved).

2. **Sidebar (`src/components/layout/Sidebar.tsx`)**
   - Brand block: rounded square logo tile + two‑line title ("DMR & GRN Portal" style) — reuse existing logo, only restyle container.
   - Section label "WORKSPACE" in uppercase tracked caps (`text-[10px] tracking-widest text-sidebar-submuted`).
   - Nav item: `h-10 rounded-lg px-3 gap-3`; active = `bg-sidebar-accent` with left 3px emerald indicator; hover = `bg-sidebar-hover`.
   - Sub‑items indented with left border in `--sidebar-border`.
   - Footer status chip ("SAP S/4HANA Connected · Last sync…") — visual only, reads existing state.
   - Numeric count badges (e.g., Approvals · 8) using emerald pill.

3. **Top header (`src/components/layout/EnterpriseHeader.tsx`)**
   - Breadcrumb style ("Workspace / Dashboard") on the left, tenant switcher + notifications + user chip on the right.
   - Keep sticky h‑16, `bg-card/80 backdrop-blur`, subtle bottom border, no heavy shadow.
   - User chip: avatar circle + name + role subtext.

4. **Page titles / section headers (shared pattern)**
   - Introduce a lightweight `PageHeader` visual pattern (title `text-2xl font-semibold`, description `text-sm text-muted-foreground`, right‑aligned action slot). Apply across existing pages by restyling their current header markup only — no prop/behavior changes. Pages touched: Dashboard, VendorList, SAPSync, SapApiSettings, AuditLogs, Reports, GstCompliance, ScheduledChecks, UserManagement, AdminInvitations, FormBuilder, AdminConfiguration, EmailConfiguration, KycApiSettings, SharviAdminConsole, approvals/* .

5. **Cards / panels**
   - Standardize on `rounded-xl border bg-card shadow-card` with `p-6`.
   - Info panels (like "How SAP Connection Works", "Auto‑Sync Scheduler", "SAP Browser Session") get a small colored icon tile in the header and a tinted top border.

6. **Buttons (visual only — no handler/prop changes)**
   - Primary (Approve, Save, Sync, Add): emerald filled, `h-9 px-4 rounded-md`, leading icon 16px, subtle shadow on hover.
   - Secondary (View Details, Preview, Test Connection, Export/Import): outline on white, muted foreground, same size.
   - Destructive (Reject): red filled, same size.
   - Neutral (Send Back / Return / Comments): soft slate outline with icon.
   - Ensure consistent icon+label gap (`gap-2`), icon stroke width, and disabled state.

7. **Tables (approvals lists, vendors, sync monitor, audit logs, reports)**
   - Header row: `bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground` .
   - Row: `h-12`, subtle bottom border, hover `bg-muted/30`, first/last cell padding `px-4`.
   - Status column uses new pill badges.
   - Action column: right‑aligned icon buttons with tooltips (View, Approve, Reject, Send Back, Comments, Sync).

8. **Icons**
   - Continue with lucide‑react; standardize sizes: nav `h-4 w-4`, header `h-5 w-5`, buttons `h-4 w-4`, empty states `h-10 w-10`.
   - Replace any inconsistent inline colors with `text-muted-foreground` / `text-primary`.

9. **Spacing & consistency sweep**
   - Page container: `max-w-[1400px] mx-auto`.
   - Vertical rhythm between sections: `space-y-6`.
   - Form fields: label `text-sm font-medium`, input `h-9`, helper `text-xs text-muted-foreground`.

## Explicitly NOT changed

- `src/pages/VendorRegistration.tsx` and everything under `src/components/vendor/**` (including steps, KYC tabs, verification, file upload, timelines, success screens) — Vendor Registration flow is frozen.
- No changes to routing, `useAuth`, permissions, Supabase client, edge functions, hooks, business logic, form validations, or API payloads.
- No renaming of props, event handlers, or component APIs. Class‑name and markup restyling only.

## Technical Notes

- All colors via CSS variables in `src/index.css`; components must not introduce hex literals.
- Any new token added to `index.css` is mirrored in `tailwind.config.ts` under the matching key.
- Button variants reuse existing shadcn `buttonVariants` — I'll adjust the variant class strings, not the component API.
- Table restyling done at the shared `@/components/ui/table` layer plus per‑page header rows; no data shape changes.
- Verification: run typecheck/build after changes; spot‑check Dashboard, VendorList, an approval page, SAP Settings, and confirm Vendor Registration is byte‑identical in behavior and layout.

## Deliverable

A cohesive, enterprise‑grade look matching the reference screenshots across shell, pages, cards, tables, and action buttons, with the Vendor Registration flow and all functionality untouched.
