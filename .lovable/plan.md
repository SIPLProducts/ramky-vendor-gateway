

## Improve Vendor Invitation Email Body

### Clarifying the Issue

The SMTP function is now correctly encoding emails (`quoted-printable`, no base64 garbling). So "not generating good" likely means the **visual design / content** of the email body needs improvement, not the encoding.

### Proposed Redesign

Rebuild the `send-vendor-invitation` HTML template with a cleaner, more professional Sharvi-branded layout:

**Visual Improvements**
- Replace the flat blue gradient header with a clean white card + Sharvi logo wordmark and a thin colored top border (SAP Fiori inspired, matching the app's visual identity).
- Use the project's grey page background (`#F7F9FC`) outside the card and pure white (`#FFFFFF`) inside.
- Rounded card (10px radius) with subtle shadow.
- Use system font stack matching the app.

**Content Improvements**
- Personalized greeting line ("Hello, You've been invited by Sharvi Vendor Portal to register as a supplier.")
- Three-step "What happens next" mini-checklist (Click the button → Complete 7-step form → Get verified & approved).
- Estimated time to complete: ~10–15 minutes.
- Clear primary CTA button ("Start Registration") with hover-friendly styling.
- Expiry warning in an amber info box with calendar icon.
- Plain-text fallback link in a monospace box.
- Footer with support email, company name, and "automated message" disclaimer.

**Layout sketch**
```text
┌──────────────────────────────────────┐
│ [grey #F7F9FC background]            │
│  ┌────────────────────────────────┐  │
│  │ ▔▔▔▔▔ blue accent bar ▔▔▔▔▔   │  │
│  │   SHARVI Vendor Portal         │  │
│  │                                │  │
│  │   You're Invited to Register   │  │
│  │                                │  │
│  │   Hello,                       │  │
│  │   You've been invited to       │  │
│  │   register as a supplier...    │  │
│  │                                │  │
│  │   What happens next:           │  │
│  │   ① Click "Start Registration" │  │
│  │   ② Complete the 7-step form   │  │
│  │   ③ Get verified & approved    │  │
│  │                                │  │
│  │   ⏱ Takes about 10–15 minutes  │  │
│  │                                │  │
│  │   [  Start Registration  ]     │  │
│  │                                │  │
│  │   ⚠ Expires on 5 May 2026      │  │
│  │                                │  │
│  │   Fallback link: https://...   │  │
│  │                                │  │
│  │   ─────────────────────────    │  │
│  │   Need help? support@...       │  │
│  │   © Sharvi Infotech             │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### Files Changed

- `supabase/functions/send-vendor-invitation/index.ts` — replace the inline `emailHtml` template with the redesigned layout above. No logic changes (token, link, expiry, simulation mode, audit logging all stay the same).

### Deployment

After editing, redeploy `send-vendor-invitation`. No DB changes, no other functions touched.

### Open Question

If by "not generating good" you actually meant something different (e.g., garbled characters still appearing, missing subject, broken link, plain-text-only rendering in your client), reply with a screenshot of what you're seeing and I'll adjust the plan.

