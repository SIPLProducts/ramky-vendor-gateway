# Login left panel — large, fully visible brand watermark

Your reference shows a big Ramky mark filling the left side behind the headline. The current build makes it small and very faint. Change it to match the reference, but with the whole logo visible (the reference has the "RAMKY" wordmark clipped by the screen edge — that part stays fixed).

## What changes

- Make the watermark large: it occupies most of the left panel height/width, the way it reads in your reference.
- Keep the complete logo on screen — leaf mark, "RAMKY GROUP" wordmark and the "Towards sustainable growth" tagline all fully inside the panel, nothing clipped by the left edge.
- Raise visibility so it clearly reads as brand artwork behind the content (noticeably stronger than the current near-invisible level, still soft enough that headline and paragraph stay easy to read).
- Headline and paragraph sit above the watermark, vertically centered as today, with the logo's leaf shapes rising behind/above them like the reference.
- Still hidden on mobile; sign-in card and top-right logo untouched.

## Technical notes

- `src/pages/Auth.tsx` only: the watermark `<img>` inside the left branding panel gets a much larger width (about 80–90% of the panel, height-capped so it never overflows), centered placement instead of bottom-left, and higher opacity. Text block keeps `relative z-10`.
- Verified afterwards with a real screenshot of the running local app at 1280x800 to confirm nothing clips or overlaps.
