## Changes

### 1. Rename "Created" → "Created Date" in remaining tables
- `src/pages/AdminInvitations.tsx` line 990: `<TableHead>Created</TableHead>` → `<TableHead>Created Date</TableHead>`
- `src/components/admin/BuyerScmMapping.tsx` line 284: same rename
- `src/components/admin/TenantManager.tsx` line 98: same rename

(Dashboard already updated in previous turn.)

### 2. Invitations search: include phone number
File: `src/pages/AdminInvitations.tsx` (filter at lines 595–599)

Extend the `filteredInvitations` filter to also match on `invitation.phone_number`:
```ts
(invitation.phone_number ?? '').toLowerCase().includes(searchTerm.toLowerCase())
```
So the placeholder "Search by Name, Email or Phone Number" actually filters by phone.

### 3. Rename "Actions" → "Status" column header
File: `src/pages/AdminInvitations.tsx` line 992
- `<TableHead className="text-right">Actions</TableHead>` → `<TableHead className="text-right">Status</TableHead>`

(Only the header label changes; the cells in that column remain unchanged — they already show status badges alongside action buttons.)

### 4. Remove Sign Up from login page
File: `src/pages/Auth.tsx`
- Remove the `<Tabs>` wrapper and `TabsList` (lines ~222–226) so only the login form renders.
- Remove the `<TabsContent value="signup">` block and its form (lines ~288 onward through its closing tag).
- Remove now-unused signup state (`signupName/Email/Password/ConfirmPassword`), `handleSignup`, `nameSchema`, and the `signUp` import from `useAuth`.
- Update the card copy: `CardDescription` "Sign in to your account or create a new one" → "Sign in to your account".

## Out of scope
- No backend, RLS, or route changes.
- Vendor invite / vendor login flows untouched (vendors already onboard via invitation links, not this signup tab).
