## Green accent polish: sidebar, cards, table ref numbers

### 1. Sidebar active item (`src/components/layout/Sidebar.tsx`)
Keep current tinted style but strengthen the green:
- Active: `bg-primary/10 text-primary border border-primary/40 rounded-lg font-medium`
- Icon inherits `text-primary`
- Non-active hover unchanged

### 2. Dashboard KPI cards (`src/pages/Dashboard.tsx`)
Apply green treatment to ALL four cards (not just the selected filter):
- Card container: `bg-primary/5 border border-primary/30` (light green tint + green border)
- Label (`TOTAL APPLICATIONS`, etc.): change from `text-muted-foreground` to `text-primary` with existing uppercase tracking
- Value stays `text-foreground` bold
- Icon tile stays `bg-primary/10 text-primary`
- Active/selected filter card: bump to `ring-2 ring-primary border-primary` (already in place)

### 3. Table Ref # column (`src/pages/Dashboard.tsx`)
Wrap the reference number link cell content in a green pill:
- `inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[13px] font-semibold text-primary hover:bg-primary/15`
- Applied only to the `<Link>` inside the Reference # `<TableCell>` — column header and other cells unchanged

### Not touched
Vendor Registration, other pages, business logic, hooks, edge functions, routes.
