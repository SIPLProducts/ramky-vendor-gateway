## Vendor Registration — reload prompt + Back button rename

### 1) Remove the browser's native "Reload site?" prompt
The dialog in the screenshot is Chrome's built-in `beforeunload` confirmation. Its buttons ("Reload" / "Cancel") **cannot** be customized by the app — browsers block adding a third "Save and Reload" option. Since the form already auto-saves on every change (the "Saved X mins ago" indicator) and a `Save Draft` button exists, the warning is misleading.

- File: `src/pages/VendorRegistration.tsx` (~lines 700–744)
- Delete the `handleBeforeUnload` function and remove the matching `window.addEventListener('beforeunload', ...)` and `removeEventListener('beforeunload', ...)` lines.
- Leave the `popstate` and `F5 / Ctrl+R / Ctrl+W` guards untouched — those are in-app guards, not the native reload dialog.

After this change, reloading proceeds silently and the draft re-hydrates from the saved data on the next load.

### 2) Rename the top-right Back button
- File: `src/pages/VendorRegistration.tsx` (line 1737)
- Rename the button label from **Back** to **Back to main screen**.
- No other behavior changes.

### Technical notes
- Presentation + a single event-listener removal; no changes to autosave logic, validation, or persisted data.
- Verify build after edits.
