## Plan

Remove the theme color picker from the navbar.

### Edits

1. **`src/components/layout/EnterpriseHeader.tsx`** — remove the `<ThemeColorPicker variant="desktop" />` element and the `import { ThemeColorPicker } ...` line.
2. **`src/components/layout/MobileHeader.tsx`** — remove the `<ThemeColorPicker variant="mobile" />` element and the import.
3. **Delete `src/components/layout/ThemeColorPicker.tsx`** — no longer used.
4. **Keep `src/hooks/useThemeColor.tsx`** and the `ThemeColorProvider` in `src/main.tsx` — they still apply the saved/default brand palette (orange + green) on load, which is required for the rest of the app's branding to render correctly. No UI to change it remains.

### Result

- Navbar goes back to just tenant switcher + Help & Support (desktop) and Notifications + User menu (mobile).
- App keeps the brand orange/green palette already in place; login page keeps its scoped SAP blue.

No backend or routing changes.
