# Make the login page blue again

## What's happening

The login page is rendering green, not blue. The app's global `primary` colour token is green (`160 70% 38%`), and the login page uses `primary` for the hero overlay, the Sign In button and the links — so it inherits green.

A dedicated blue override already exists in the stylesheet (`.login-theme`, SAP blue `210 100% 40%`), but that class is not applied to the login page's root element, so it never takes effect.

## Fix

- Apply the existing `login-theme` class to the root wrapper in the login page so the blue palette overrides the green theme for that page only.
- Result: hero overlay over the construction photo becomes blue, the Sign In button becomes blue, and "Forgot password?" / support email links become blue — matching the reference.
- No global theme change; every other screen keeps its current colours.

## Technical detail

`src/pages/Auth.tsx` — add `login-theme` to the outermost `div` className (line ~87). Keep the overlay gradient as `from-primary/80 via-primary/60 to-slate-900/70`, which then resolves to blue.
