## 1px selected border on Dashboard KPI cards

### Change
In `src/pages/Dashboard.tsx`, update the selected/active state of the four KPI filter cards so the highlight border is **1px** instead of the current 2px ring.

Current class:
```
active && 'ring-2 ring-primary border-primary'
```

Planned class:
```
active && 'ring-1 ring-primary border-primary'
```

### What stays the same
- All existing card spacing, shadows, typography, and icon styling.
- Click-to-filter behavior and keyboard accessibility.
- Business logic, data fetching, exports, and the vendor table below.
- Sidebar, buttons, vendor registration, and all other screens.

### Files touched
- `src/pages/Dashboard.tsx` (one line className change)