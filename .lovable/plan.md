## Force visible active tab + checkbox styles on SAP Sync

The earlier edit used `data-[state=active]:bg-primary` but the shadcn `TabsTrigger` base already sets `data-[state=active]:bg-background` and `data-[state=active]:text-foreground`, so with tailwind-merge my override applies but resolves to near-white on the light grey list — so the active tab still doesn't pop. Same for the checkbox: base component sets `border-primary` (blue) which visually competes with my `border-black`. Fix with stronger, explicit styles in `src/pages/SAPSync.tsx` only.

1. **Active tab** — On all three `TabsTrigger`s replace the current active override with explicit high-contrast classes:  
   `data-[state=active]:!bg-blue-600 data-[state=active]:!text-white data-[state=active]:!shadow-md`  
   Also darken the inactive surface so contrast is obvious by changing the `TabsList` wrapper to `bg-slate-100 border border-slate-200`.

2. **Checkboxes** (select-all in SAP toolbar, per-row SAP checkbox, per-row DMS checkbox) — replace current classes with:  
   `!bg-white !border-2 !border-black data-[state=checked]:!bg-white data-[state=checked]:!text-black`  
   so both unchecked and checked states stay white with a black border and a black tick — matching the outlined Preview-style look the user pointed at.

Scope: `src/pages/SAPSync.tsx` only. No other screens, no logic changes.