
Scope: the "View Details" popup only — `src/components/vendor/VendorReviewDialog.tsx`. No other screens touched.

### Goal
The dialog should look the same at every browser zoom level (50% / 75% / 90% / 100% / 125% / 150%). Currently at 100%+ zoom the effective viewport shrinks and content wraps/overflows; the user wants the 75%-zoom look preserved.

### Approach — counter-zoom the dialog content
Use CSS `zoom` on the dialog content wrapper, driven by `window.devicePixelRatio` and `window.outerWidth / window.innerWidth` (the ratio browsers expose for zoom). Compute a factor so the dialog effectively renders at 75%-zoom regardless of the user's actual zoom.

Implementation:
1. **Hook**: add a small `useBrowserZoom()` hook (inline in the file, no new files) that:
   - Reads zoom as `Math.round((window.outerWidth / window.innerWidth) * 100) / 100` on mount, on `resize`, and on `visibilitychange`.
   - Falls back to `window.devicePixelRatio` when `outerWidth` is unreliable (e.g. some Chromium PWAs).
2. **Scale factor**: `scale = 0.75 / currentZoom` (clamped between 0.5 and 1.5 for safety).
3. **Apply**: wrap the existing `DialogContent` inner tree in a `<div style={{ zoom: scale }}>`. CSS `zoom` (not `transform: scale`) is the right primitive here because it also resizes the layout box, so the dialog stays centered, the shadcn overlay stays correct, and scrolling in the tabs continues to work without manual width math.
4. **Dialog width**: bump `DialogContent` max width from `max-w-5xl` to `max-w-6xl` so the counter-scaled content has room at 75%-equivalent density, then let `zoom` shrink it visually at higher browser zoom.
5. **Guard for Firefox**: Firefox does not support CSS `zoom`. Detect via `CSS.supports('zoom', '1')`; when unsupported, fall back to `transform: scale()` with `transform-origin: top left` on the same wrapper and set an explicit inverse `width`/`height` so the dialog still fits.

### Out of scope
No global changes to the app shell, no root-level zoom counter, no changes to other dialogs, tables, sidebars, or the registration form. If the same treatment is wanted elsewhere later, the same hook can be reused.

### Notes / trade-offs
- CSS `zoom` overrides the user's chosen browser zoom for this dialog specifically. That is exactly what was requested.
- Content inside the dialog (e.g. `VendorDocuments`, `GstFilingStatusTable`) inherits the zoom automatically — no per-child edits needed.
- Print styles and screen readers are unaffected because `zoom` is a visual transformation only on this wrapper.
