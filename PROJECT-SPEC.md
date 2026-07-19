# Best Pen Agency — Influenzar Program Site
**Consolidated spec, pulled from everything discussed so far.**
Review this and mark corrections — anything wrong, missing, or changed is fair game to edit.

---

## 1. Brand & Identity
- Full brand name everywhere: **"Best Pen Agency"** (not "Bestpen") — already applied site-wide.
- Logo: a plain circular wrapper (`brand-mark` / `logo-circle`), empty by default, holding a single `<img>` pointing to `images/logo.png` — ready for a real logo asset to be dropped in.
- Domain: `bestpenagency.vercel.app`.
- Tech stack: static HTML/CSS/vanilla JS, hosted on Vercel, Supabase for auth + database. No frameworks, no build step.

---

## 2. Site Structure

### Public pages (no login required)
- `/` → redirects to `/influenzar` (the home/landing page)
- `/influenzar` — main landing page, rebuilt from the original WordPress export, same copy/structure/branding
- `/services` — lists all 6 services (see §7). **No "Get Started" CTA button** — removed per instruction; the only calls-to-action tied to conversion live on `/influenzar` and are connected to the referral system.
- `/our-work` — placeholder "coming soon" page, publicly accessible, **no auth gate** (confirmed this was never actually gated — a reported bug that wasn't real)
- `/resources` — placeholder "coming soon" page
- `/about` — placeholder "coming soon" page
- `/register` — sign-up form
- `/login` — log-in form
- `/forgot-password` — request a password reset email
- `/reset-password` — landing page for the emailed reset link, where a new password is set
- `/confirmed` — landing page after tapping the email confirmation link

### Gated pages (require login)
- `/dashboard` — the default landing spot after login; shows onboarding wizard on **first login only** (see §5)
- `/referrals`, `/earnings`, `/payouts`, `/leaderboard`, `/rewards` — currently empty-state placeholder pages, ready for real data later
- `/settings` — **currently being rebuilt** (see §8 — not yet in this state)
- `/profile` — **being folded into `/settings` as a panel** (see §8)

### Navigation
- Public pages: top navbar with Services / Our Work / Influenzar Program / Resources / About Us, plus Log In / Join Influenzar. All links are real routes now, no dead `#` placeholders.
- Gated pages: **no left sidebar** on either mobile or desktop. Unified top bar with a logo (left) and a circular avatar button (right). Tapping the avatar opens a **right-side slide-out drawer** containing: Overview, Referrals, Earnings, Payouts, Leaderboard, Rewards, Settings, and Log Out. The drawer header (avatar + name) is **static display only** — not clickable, no "View Profile" shortcut (Profile is reached only via Settings).

---

## 3. Page-transition behavior
- Every internal link (nav, footer, CTAs) shows a **2-second delay** before navigating — a thin blue progress bar at the top of the screen, no destination text revealed, no full-screen takeover.
- External links, `#` same-page anchors, `mailto:`/`tel:` links are excluded — those still jump instantly.
- **Open issue flagged by you, not yet resolved:** the delay is currently firing on some things that aren't real page-to-page navigation (e.g. actions that just toggle state on the same page). This still needs auditing and fixing — pending.
- **Also flagged:** Settings navigation should not use this loading-bar pattern at all — instead, tapping a settings row should **slide a panel in from the right** (like a native app), with a **‹ back arrow** to return, no page reload and no loading bar. This is the in-progress Settings rebuild (§8).

---

## 4. Authentication & Referral System

### Auth (Supabase)
- Sign up / log in / log out / forgot password / reset password — all wired to Supabase Auth.
- Email confirmation required before dashboard access; confirmation link redirects to `/confirmed`.
- Dashboard and all gated pages check for a valid session and redirect to `/login` if none exists.

### Database (Supabase Postgres)
- `public.profiles` — one row per user: `id`, `name` (captured at registration), `referral_code` (auto-generated), `referred_by_code`, plus onboarding fields added later: `username`, `gender`, `avatar_url`, `date_of_birth`, `address`, `onboarding_completed`.
- `public.purchases` — `user_id`, `service_name`, `amount`, `status`, `created_at`. Empty until real orders exist; dashboard already reads from it.
- `public.referral_lookup` — a public view exposing **only** the `referral_code` column, so anonymous visitors can validate a code before signing up, without ever exposing names/emails.
- A Postgres trigger (`handle_new_user`) auto-generates each new user's unique 8-character referral code and links them to whoever referred them, the moment they sign up — no client-side code needed for this part.
- **RLS policies required** (this was the source of a real bug — "Something went wrong saving your details" / 400 errors): users need explicit `select`/`update` policies on their own `profiles` row and `select` on their own `purchases` rows. Fixed via SQL patch.

### Referral capture & validation
- A link like `bestpenagency.vercel.app/influenzar?ref=AB12XZ9K` gets captured into `localStorage` the instant it's visited (and now on **any** page that loads the shared JS, not just `/influenzar`), surviving further browsing.
- `/register` auto-fills the captured code into a **"Referral code (optional)"** field.
- Anyone typing a code manually gets it checked the instant they click away from the field (on blur) — a small spinner turns into a ✓ or ✕, validated against real registered users via `referral_lookup`.
- Dashboard shows the logged-in user's own referral link (`/influenzar?ref=THEIRCODE`) with a copy button.

---

## 5. Onboarding Wizard (first login only)
- Triggers the **first** time a user reaches `/dashboard` after confirming their email — and **only** the first time. Once completed, every future login or page visit goes straight to the normal page — no wizard, no re-prompting. *(This depends on the `onboarding_completed` flag saving correctly to the database — see the RLS fix above; if it's still reappearing after that fix, that's the next thing to verify.)*
- Full-screen white overlay, each step fading in with a smooth "fade-in-up" animation, step-progress dots at the top.
- **Step 1 — Account basics:** username, date of birth, address (all required).
- **Step 2 — Gender:** two large buttons, Male / Female.
- **Step 3 — Avatar selection:**
  - Shows a gender-matched grid (24 male or 24 female avatars, real cropped images).
  - Beneath it, always shows a second grid of **36 nature-themed avatars** as an alternative, under the line *"Prefer something different? Pick a nature-inspired avatar instead."*
  - Both grids sit in a **scrollable container** so nothing requires zooming out to see.
  - Tapping an avatar swaps the grid for a **large preview** of the choice, with a **"Choose another profile pic"** link beneath it (tapping it brings the scrollable grid back) and the Continue button.
- **Step 4 — Summary & confirm:** shows chosen avatar, username, gender, DOB, address; "Go to Dashboard" button writes everything to `profiles` in one Supabase update, then reveals the real dashboard.

---

## 6. Dashboard
- "Welcome back, {username} 👋" (from the profile, not a raw account username/email).
- Total Earnings card with placeholder chart (no fake data — real ₦0 / empty states until real activity exists).
- Stat row: Successful Referrals / Pending Earnings / Deals — all zeroed out, tied to the real user by ID once data exists.
- Recent Referrals — empty state until real referrals convert.
- **Services Purchased** — empty state until rows exist in `purchases`; will list real purchases once wired up.
- **Your Referral Link** card — shows the real generated link + copy button.
- No leftover "hanging" decorative cards (the flashy blue/yellow/white mockup-style widgets were explicitly removed early on).

---

## 7. Services (content only, no purchase flow yet)
1. **Website Development** — one-time project
2. **Graphic Design** — one-time project
3. **Video Editing** — one-time project
4. **Social Media Management** — typically a recurring retainer
5. **Copywriting** — usually an add-on to another service
6. **Email Marketing** — typically a recurring retainer

*(Noted for later: one-time vs. recurring services may need a `billing_type` field on `purchases` down the line, since a referral into a retainer service should arguably keep paying commission every renewal — not decided yet, just flagged.)*

---

## 8. Settings — IN PROGRESS (not yet built this way)
**Agreed direction (Option A):** Settings becomes one true single-page app — no more separate pages/URLs per section. A single `/settings` shell loads each section as an in-memory "panel" and slides it in from the right / back out to the left, with a **‹ back arrow**, matching native-app UX. No page reload, no loading bar, since nothing is actually navigating anywhere.

**Files to be deleted once this is built:**
`profile.html`, `payout-settings.html`, `themes.html`, `security-center.html`, `feedback.html`, `close-account.html`

**Files to be created:**
```
settings/
├── settings.html      ← the shell (the only real page/URL)
├── settings.css
├── settings.js         ← panel switching, slide animation, back arrow
└── panels/
    ├── profile.js
    ├── payout-settings.js
    ├── reset-password.js
    ├── themes.js
    ├── security-center.js
    ├── feedback.js
    └── close-account.js
```

**Settings list — exact order, nothing added beyond this:**
1. My Profile
2. Payout Settings
3. Reset Password
4. Themes
5. Security Center / Customer Services
6. Feedback and Suggestions
7. Close Account
8. About
9. Sign Out

**Profile panel — exact fields, nothing extra (explicitly no account tier, no OPay-style account number, no phone number unless later requested):**
- Avatar (from onboarding)
- Username (this is the field — not "Nickname")
- Full Name (the name entered at registration, read-only)
- Gender
- Date of Birth
- Address

---

## 9. Admin — NOT STARTED
- Discussed only at a conceptual level so far — no code written.
- Still open: what actions an admin can take (mark a purchase, approve a payout, edit a user, etc.), what data they need to see, what triggers something needing attention, and how you (the site owner) will control access. You said you'd handle access control yourself and wanted to think through the logic before any code gets written.

---

## 10. Known bugs — status
| Issue | Status |
|---|---|
| Root domain not redirecting to `/influenzar` after `landing.html` was deleted | ✅ Fixed — `vercel.json` redirect added |
| Supabase `Invalid supabaseUrl` error | ✅ Fixed — was a malformed URL pasted into `supabase-client.js` |
| "Something went wrong saving your details" / 400 error during onboarding | ✅ Likely fixed — missing RLS policies added; **needs your confirmation it's resolved** |
| Onboarding "Continue" button hidden without zooming out | ✅ Fixed — overlay + avatar grids now scrollable |
| No way to change a chosen avatar before continuing | ✅ Fixed — "Choose another profile pic" flow added |
| Services page had a stray "Get Started" button unrelated to the referral flow | ✅ Fixed — removed |
| 2-second loading bar firing on things that aren't real page navigation | ⏳ **Still open** — needs auditing |
| Settings as a single sliding-panel app instead of separate pages | ⏳ **In progress** — plan agreed, not yet built |
| Admin page | ⏳ **Not started** — logic still being discussed |

---

*End of spec. Edit anything above — wording, scope, order, additions, removals — and send it back and I'll treat it as the new source of truth.*
