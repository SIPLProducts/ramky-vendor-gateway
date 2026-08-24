Login page color verification

## Goal
Confirm that the login page left panel uses the intended blue color treatment.

## Current state
`src/pages/Auth.tsx` applies a blue gradient overlay on the construction hero image:

```tsx
<div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/60 to-slate-900/70" />
```

- `primary` is the brand blue token.
- The overlay is therefore blue, with a gradient that darkens toward the bottom-right.

## Decision
No change required. The user confirmed the current blue gradient overlay should be kept as-is.

## Implementation
No code edits. Verify in the preview that the left panel renders the blue gradient on the hero image.
