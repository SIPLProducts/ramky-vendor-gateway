## Goal
Modernize the app's look & feel to match the reference screenshots (Rithwik / Operations Dashboard) — tighter layout, refined typography, greener selected sidebar item, and reference-style dashboard cards. Purely visual. No functional, routing, API, or Vendor Registration changes.

## Scope (visual only)

### 1. Sidebar — selected item
File: `src/components/layout/Sidebar.tsx` (+ tokens in `src/index.css`)
- Selected item background: switch from `bg-sidebar-accent` (dark slate) to the app's **primary emerald green** with white text, matching the reference's filled green pill.
- Slightly narrower selected pill: reduce horizontal reach by adding `mx-2` (or `mx-1.5`) to items and using `rounded-md` so the green fill sits inside the rail rather than edge-to-edge.
- Keep hover = `bg-sidebar-hover`, keep icon sizing, keep collapsed behavior.
- Left indicator bar removed (reference uses solid fill instead).

### 2. Screen layout padding
Files: `src/components/layout/AppLayout.tsx`, `src/components/layout/EnterpriseHeader.tsx`
- Main content: `px-4 py-6 lg:px-8 lg:py-8` → **`px-4 py-4 lg:px-6 lg:py-5`** (tighter horizontal + top rhythm, matches reference density).
- Header: reduce height from `h-16` → **`h-14`**, padding `px-4 lg:px-6`.
- Dashboard page inner wrapper: `p-4 md:p-6 space-y-6` → **`p-0 space-y-5`** (padding now comes from AppLayout only).
- Apply the same trim to other top-level pages that self-pad (VendorList, SAPSync, Reports, AuditLogs, Admin*, etc.) — change outer wrapper padding only, no structural edits.

### 3. Typography scale
File: `src/index.css` (utility classes) + targeted className swaps
- Page title: `text-2xl font-semibold` → **`text-[26px] font-semibold tracking-tight`** with `text-sm text-muted-foreground` description (matches "Operations Dashboard" style).
- Card title (KPI label): **`text-[11px] font-semibold uppercase tracking-wider text-muted-foreground`**.
- Card value: **`text-3xl font-semibold tracking-tight`** (reference uses ~32px bold numeric).
- Card delta/description row: `text-xs` with colored pill (`+12.4%` green / `-3` amber).
- Table header: already `text-[11px] uppercase tracking-wider` from prior pass — keep.
- Table data rows: **`text-sm`**, row height `h-11`.
- Form labels: **`text-xs font-medium text-muted-foreground`** (standardize via existing `<Label>` — no field-level edits in Vendor Registration).
- Buttons: `text-sm font-medium`, `h-9` default (already in place).

### 4. Dashboard KPI cards
File: `src/pages/Dashboard.tsx` only (rendering)
Match reference card anatomy:
```text
┌───────────────────────────────────┐
│ LABEL (uppercase, muted)   [icon] │
│ 248                                │
│ [▲ +12.4%]  vs last month         │
└───────────────────────────────────┘
```
- Card: `rounded-xl border bg-card shadow-card p-5`.
- Icon in top-right inside a `h-9 w-9 rounded-lg bg-primary/10 text-primary` tile.
- Value large and tight underneath the label.
- Selection ring (existing filter click behavior) preserved — just restyled: `ring-2 ring-primary` when active.
- Keep click-to-filter, keep the same 4 KPIs, keep counts/logic untouched.

### 5. Buttons
File: `src/components/ui/button.tsx`
- Default (primary) already emerald — confirm hover uses `bg-primary-hover`, add subtle `shadow-sm`.
- Outline: white bg, `border-border`, `hover:bg-muted`, icon `h-4 w-4` with `gap-2`.
- Ghost destructive stays red.
- Standardize icon buttons to `h-9 w-9 rounded-md`.
- Header "Export / Refresh" style: outline + primary pair matches reference.

### 6. Tables
File: `src/components/ui/table.tsx`
- Header cell: keep micro-caps, add `text-muted-foreground/80`.
- Body cell: `py-3 text-sm`, row hover `bg-muted/40`.
- Status pills: swap plain Badge for tinted pills (`bg-success/10 text-success`, `bg-warning/10 text-warning`, `bg-destructive/10 text-destructive`, `bg-primary/10 text-primary` for info) using existing `.status-*` utility classes.

## Explicitly NOT touched
- `src/pages/VendorRegistration.tsx` and all of `src/components/vendor/**` (steps, KYC, timeline, upload, success).
- Any `supabase/functions/**`, hooks, `useAuth`, permissions, routing.
- Business logic, validation rules, data queries, workflow state machine.
- Auto-generated files (`src/integrations/supabase/*`, `.env`, `supabase/config.toml`).

## Verification
- Typecheck / build after edits.
- Manually eyeball: Dashboard, VendorList, SAPSync, AuditLogs, one Approval page, one Admin page.
- Confirm Vendor Registration renders identically to today.
