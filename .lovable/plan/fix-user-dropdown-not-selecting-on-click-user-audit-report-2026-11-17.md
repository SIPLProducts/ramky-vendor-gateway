# Fix: User dropdown not selecting on click (User Audit Report)

## Problem
On the User Audit Report page, the User list opens and shows names, but clicking a name does nothing. Selecting only works by typing and pressing Enter. The same issue was seen in my earlier test.

## Fix
- Make each name in the list respond directly to a mouse click / tap (not only keyboard Enter), so clicking selects the user and closes the list.
- Match the selection by the user's unique ID instead of the name text, so two users with similar names can never clash.
- Keep search, the Inactive tag, the role line and the tick mark exactly as they are.

## Verify
- Open the page in the test browser, click the User box, click a name with the mouse, and confirm the name shows in the box and the report loads.
- Also confirm typing + Enter still works.

## Technical details
- File: `src/pages/UserAuditReport.tsx` only.
- Add `onClick` (and `onPointerDown` preventDefault to keep focus) on `CommandItem` calling the same select handler; set `value={p.id}` and use a `keywords` prop (`[full_name, email]`) so cmdk search still matches name/email.
- No backend or permission changes.
