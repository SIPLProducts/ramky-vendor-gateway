## Problem
In the approval matrix config, the CEO Office stage displays "(MSME only)" more than once.

## Root Cause
A leftover `· (MSME only)` suffix remains on line 765 of `src/components/admin/ApprovalMatrixConfig.tsx` inside the chain badge loop. Line 764 already appends `(MSME only)` for the CEO_OFFICE stage, so line 765 creates a duplicate.

## Fix
In `src/components/admin/ApprovalMatrixConfig.tsx`, remove the duplicate `(MSME only)` suffix on the CEO Office chain badge (line 765).

## Out of Scope
- No database migrations
- No edge function changes
- No other approval matrix logic changes