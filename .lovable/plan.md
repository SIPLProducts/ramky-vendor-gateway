## Sidebar selection + card polish

### 1. Sidebar selected item (`src/components/layout/Sidebar.tsx`)
Change selected item from solid emerald fill to a **tinted green pill with a green border and green text** — same treatment as a soft "chip":
- Selected: `bg-primary/10 text-primary border border-primary/30 rounded-lg` (was `bg-primary text-primary-foreground shadow-sm`)
- Icon inherits `text-primary`.
- Hover on non-active stays `bg-sidebar-hover`.
- Collapsed active indicator bar stays the same (already `bg-primary`).

### 2. Dashboard KPI cards (`src/pages/Dashboard.tsx`)
Match the reference exactly:
- Card container: keep `p-5 rounded-xl border bg-card shadow-card`.
- Value color: ensure `text-foreground` bold `text-[32px]`.
- Icon tile: `h-10 w-10 rounded-lg bg-primary/10 text-primary` (slightly larger, softer green like reference).
- Add a subtle "vs last month" placeholder row below the value using existing status color tokens — **skipped** since we have no delta data; keep the current single-value layout as-is, only bump icon tile size.

### 3. Export button (`src/pages/Dashboard.tsx`)
Already uses default primary variant with rounded-lg + shadow — matches the reference. No change needed unless icon spacing off; keep as-is.

### Not touched
Vendor Registration, business logic, routes, workflows, hooks.
