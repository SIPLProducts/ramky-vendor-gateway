

## Formal & Elegant Vendor Invitation Email Redesign

### Current Email Body Issues
The current email is functional but lacks the sophistication expected for enterprise B2B communications. It needs:
- More formal, professional tone
- Elegant typography and spacing
- Refined color palette (less bright, more corporate)
- Better visual hierarchy
- Professional signature block

### Proposed Elegant Design

**Visual Style:**
- **Color Palette**: Deep navy (#1e3a5f) for headers, soft gold/amber (#d4a574) for accents, charcoal (#2d3748) for text
- **Typography**: Elegant serif for headings (Georgia), clean sans-serif for body (system fonts)
- **Layout**: Generous whitespace, refined borders, subtle shadows
- **Card**: Pure white with 1px subtle border (#e2e8f0), 12px border radius

**Email Body Structure:**

```html
┌─────────────────────────────────────────────────────────┐
│  [Soft grey #f8fafc background]                         │
│    ┌──────────────────────────────────────────────┐    │
│    │  ▓▓▓ Deep Navy Header Bar (#1e3a5f) ▓▓▓      │    │
│    │                                                │    │
│    │      [Company Logo Wordmark - White]           │    │
│    │      Vendor Portal                             │    │
│    │                                                │    │
│    └──────────────────────────────────────────────┘    │
│                                                        │
│    ┌──────────────────────────────────────────────┐    │
│    │                                                │    │
│    │   Vendor Registration Invitation               │    │
│    │                                                │    │
│    │   ─────────────────────────────────────        │    │
│    │                                                │    │
│    │   Dear Valued Business Partner,                │    │
│    │                                                │    │
│    │   [Company Name] cordially invites you to      │    │
│    │   register as an approved supplier in our      │    │
│    │   Vendor Management Portal.                    │    │
│    │                                                │    │
│    │   This secure registration process enables     │    │
│    │   streamlined collaboration and ensures          │    │
│    │   compliance with our procurement standards.     │    │
│    │                                                │    │
│    │   ┌─────────────────────────────────────┐       │    │
│    │   │  REGISTRATION PROCESS               │       │    │
│    │   │                                     │       │    │
│    │   │  ①  Access Registration Portal      │       │    │
│    │   │  ②  Complete Supplier Profile       │       │    │
│    │   │  ③  Verification & Approval         │       │    │
│    │   │                                     │       │    │
│    │   │  Estimated Time: 10–15 minutes      │       │    │
│    │   └─────────────────────────────────────┘       │    │
│    │                                                │    │
│    │   [    BEGIN REGISTRATION    ]                 │    │
│    │   (Gold/Amber button #d4a574)                  │    │
│    │                                                │    │
│    │   ┌─────────────────────────────────────┐       │    │
│    │   │  ⚠  INVITATION EXPIRES: [Date]    │       │    │
│    │   └─────────────────────────────────────┘       │    │
│    │                                                │    │
│    │   Should you encounter any difficulties,       │    │
│    │   please contact our support team at           │    │
│    │   [support email].                             │    │
│    │                                                │    │
│    │   ─────────────────────────────────────        │    │
│    │                                                │    │
│    │   Respectfully,                                │    │
│    │   Procurement Team                             │    │
│    │   [Company Name]                               │    │
│    │                                                │    │
│    └──────────────────────────────────────────────┘    │
│                                                        │
│    [Footer: © 2025 Company Name. All rights reserved.] │
│                                                        │
└─────────────────────────────────────────────────────────┘
```

### Key Improvements

1. **Tone**: "Dear Valued Business Partner" instead of casual "Hello"
2. **Language**: Formal business English ("cordially invites", "streamlined collaboration")
3. **Visual Hierarchy**: Clear sections with elegant dividers
4. **Color Scheme**: Deep navy, soft gold, charcoal - corporate and refined
5. **Button**: "BEGIN REGISTRATION" in elegant gold/amber instead of bright blue
6. **Signature**: Professional sign-off with "Respectfully, Procurement Team"
7. **Expiry Notice**: Styled as important but not alarming

### Files to Change

- `supabase/functions/send-vendor-invitation/index.ts` — Replace the `emailHtml` template (lines 76-209) with the new elegant design

### Deployment

After editing, redeploy `send-vendor-invitation` Edge Function.

