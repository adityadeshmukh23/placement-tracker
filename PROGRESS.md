# Progress

Status as of inspecting the actual codebase + `git log` on `main`. "Verified"
means driven live in a browser preview and checked against expected numbers/
translations — there is no automated test suite, so this is the only
verification that has happened anywhere in this project.

**Read this first:** the UI polish pass is now committed (`b570b49`). The
newest work — **optional Supabase cloud sync** — is code-complete and verified
locally (typecheck, build, full offline flow on the new schema) but its
**live two-phone sync is unverified** because that needs a real Supabase
project only the owner can provision. Commit status of the sync work is noted
in its section below.

---

## Done and committed

### Project scaffold & tooling
Next.js 14 App Router + TypeScript + Tailwind, mobile-first shell (viewport
meta, 16px base font), Dexie + next-pwa installed.
**Verified:** dev server ran, home page rendered.

### Data layer (`lib/db.ts`, `lib/types.ts`)
Dexie schema for Shop/Tenant/Payment; helpers for status-joined shop lists,
monthly summaries, vacancy counting, usual-payment-amount lookup, tenant
add/remove with soft-deactivation enforcement.
**Verified:** a temporary Node script (via `fake-indexeddb`) exercised
add-shop → add-tenant → add-payment → read-back and was deleted after
confirming output.

### Internationalization
`lib/translations.ts` (key → `{en, mr}` pairs) + `LanguageContext.tsx` +
`useTranslation()` hook + a persistent language toggle.
**Verified:** live toggle between languages in the browser preview,
localStorage persistence across reload.

### Shop & tenant management screens
All Shops (grouped by area, searchable), Add Shop, Add Tenant, Shop Detail.
**Verified:** full add-shop → add-tenant flow driven live; screens re-checked
during the later polish pass.

### Payment recording flow
FAB → shop picker → pre-filled payment form (amount defaults to last-paid or
rent, date defaults to today) → save, plus a one-tap "mark as paid" shortcut
on shop rows using the same usual-amount logic.
**Verified:** both the full form and the one-tap path, checked against
IndexedDB records directly.

### Dashboard (home screen)
Summary card (collected/pending/paid-vs-unpaid counts, current month only,
vacant shops excluded), a "This Month" vs "All Shops" toggle, one-tap
send-reminder per unpaid shop.
**Verified:** numbers checked by hand against seeded sample data before and
after recording a payment.

### Payment history (ledger)
Per-shop chronological ledger with synthetic "missed month" rows, a year
filter, and a running total for the selected year.
**Verified:** seeded a shop with a deliberate gap month and confirmed the
ledger showed paid/missed/total correctly, in both languages.

### Reports
Monthly (per-shop breakdown for a chosen month) and Yearly (12-month bar
chart + table) tabs, CSV export on both.
**Verified:** numbers cross-checked against seeded data; exported CSVs opened
and inspected.

### Progressive Web App
Manifest + generated icons, install-prompt banner
(`beforeinstallprompt`-driven, dismissible, localStorage-remembered), offline
app shell caching.
**Verified non-trivially** — two real bugs were found and fixed here, not
just assumed working:
- next-pwa's auto-register never fires under the App Router (it only injects
  via the Pages Router's `_document`); added a manual
  `ServiceWorkerRegister` component.
- The generated service worker's install step 404'd on
  `app-build-manifest.json` (an App-Router-internal file, never served
  publicly), which failed the *entire* install; fixed with a
  `buildExcludes` regex in `next.config.mjs`.
- Confirmed via a full `next build && next start` cycle, inspecting the
  actual `Cache Storage` contents in the browser, not just trusting the
  build log.

### WhatsApp integration
"Send Receipt" after recording a payment and "Send Reminder" per unpaid shop
on the Dashboard, both building a `wa.me` deep link with a pre-filled,
language-aware message. Landlord sign-off name is captured once via a native
prompt and remembered in localStorage (no dedicated settings screen exists
for it — see Known gaps).
**Verified:** actual generated message text checked in both languages
against the exact phone-normalization and phrasing.

### Recovery from a near data-loss incident
Everything above once existed only as *uncommitted* working-tree state in a
different folder that was believed deleted. It was recovered intact from an
orphaned git worktree still on disk, then committed:
- `57f7210` — the entire app up through PWA + Reports.
- `ea201aa` — the WhatsApp integration.

This is why "committed" vs "not committed" is called out explicitly
throughout this document — it has bitten this project once already.

---

### UI polish pass — committed `b570b49`
Committed as the pre-step before the cloud-sync work. The files that made it up
were:
`app/page.tsx`, `app/payments/new/page.tsx`, `app/reports/page.tsx`,
`app/shops/page.tsx`, `app/shops/[shopId]/page.tsx`,
`app/shops/[shopId]/tenants/new/page.tsx`, `app/shops/new/page.tsx`,
`app/components/{FormField,InstallPrompt,LanguageToggle,PaymentHistory,
StatusPill}.tsx`, `lib/db.ts`, `lib/translations.ts`; new:
`app/components/ConfirmDialog.tsx`, `lib/confirmMessages.ts`; deleted:
`lib/seed.ts`.

What's in that diff:
- **Touch targets/fonts:** every control under 44px bumped to `h-11`+; the
  smallest text size removed app-wide (`text-xs` → `text-sm`, most
  `text-sm` content bumped to `text-base`).
- **Loading states:** skeleton placeholders (matching real layout, not
  spinners) added everywhere data loads — Dashboard, `/shops`, Shop Detail,
  Payment History, both Reports tabs.
- **Delete/remove with confirmation:** `deleteShop`, `removeTenant`,
  `deletePayment` added to `lib/db.ts` (none of this existed before this
  pass — there was previously no way to delete anything). A custom
  `ConfirmDialog` component was built specifically because native
  `window.confirm()` renders OK/Cancel in the browser's locale, not the
  app's — unacceptable for a fully-Marathi user session.
- **First-launch onboarding:** removed an auto-seed-demo-data-on-first-load
  behavior (`lib/seed.ts`, deleted) that meant a true empty state could never
  be seen by a real user; replaced with a real "Welcome to Rental Book" screen
  + "+ Add Shop" call to action, shown only when zero shops exist.
- **Marathi audit:** walked every screen live in Marathi, including the new
  delete dialogs and onboarding state. Found and fixed one real gap (the
  language-toggle button's `aria-label` was hardcoded English). Everything
  else was already correctly translated.

**Verified:** the full add-shop → add-tenant → add-payment → delete-payment →
remove-tenant → delete-shop cycle, in both languages, no console errors,
`tsc --noEmit` and a production `next build` both clean.

---

## Done in code + verified locally, but **live sync unverified**

### Cloud sync (Supabase) — optional, off by default
The whole household shares one dataset across phones by syncing through
Supabase; the app still works fully offline with no account. Access is unlocked
by a **single shared PIN** (no per-person logins). Built per the approved plan
(`.claude/plans/frolicking-tinkering-cook.md`), then extended from an
email+password login to the shared-PIN model.

What was built:
- **Schema migration to sync-ready shape** (`lib/types.ts`, `lib/db.ts`):
  integer auto-increment PKs → client-generated UUIDs; added
  `updatedAt`/`deletedAt`/`dirty` to every record. Dexie bumped to v3
  (v2 drops the old integer stores — a deliberate fresh start, no data
  migration). Hard deletes became **tombstones**; every read now filters out
  tombstoned rows (`notDeleted`).
- **Supabase client** (`lib/supabase.ts`): env-gated (`isSyncConfigured`).
  `signInWithPin(pin)` = sign in to the one shared account (fixed `SYNC_EMAIL`,
  PIN = password). Absent env vars → whole feature is a no-op.
- **Sync engine** (`lib/sync.ts`): push dirty rows → pull remote changes since
  a stored cursor → merge by last-write-wins on `updatedAt`; tombstones
  propagate. Guarded on configured/online/signed-in; swallows network errors.
- **PIN auth + triggers + UI** (`lib/SyncContext.tsx`,
  `app/components/PinGate.tsx`, `app/components/SyncBar.tsx`, wired in
  `app/layout.tsx`): a full-screen `PinGate` prompts for the shared PIN on
  first launch (skippable → "Continue without sync"); the PIN is remembered in
  localStorage and re-used to silently re-auth if the session lapses. Syncs on
  unlock, on a ~20s poll, on reconnect, and debounced after local writes. A
  "Cloud Sync" bar (only when configured) shows status + sign-out. Dashboard
  and shops list refetch on a `bhadebook:synced` event so pulled changes appear
  without a manual reload. New en/mr translation keys added.
- **Backend + docs** (`supabase/schema.sql` with RLS, `.env.example`,
  `docs/CLOUD_SYNC_SETUP.md`). Added `@supabase/supabase-js`.

**Verified locally (sync unconfigured):** `tsc --noEmit` clean, `next build`
clean, and the full offline CRUD flow re-run on the new UUID/tombstone schema
in EN + MR — deleted records disappear from every view, money totals stay
correct, and neither the PIN gate nor the sync bar appears with no env set.

**Verified against a local fake Supabase** (a throwaway auth + REST stub, to
exercise the network path without the owner's project): wrong PIN rejected,
correct PIN unlocks + persists (no re-prompt after reload), device A's
shop/tenant/payment push up, a freshly-wiped "device B" pulls them after
entering the PIN (tombstoned rows stay hidden), and a payment added while
offline stays queued (`dirty`) then pushes automatically on reconnect.

**NOT yet verified (needs the owner's real Supabase project):** behavior
against actual Supabase auth/RLS and Postgres, and last-write-wins on a real
concurrent conflict. Follow `docs/CLOUD_SYNC_SETUP.md` (create the shared user
with the PIN as its password) to run this on two real phones.

**Commit status:** this work is currently **uncommitted** in the working tree
(the schema migration + all sync files + docs). Not committed automatically —
awaiting the owner's go-ahead.

---

## Known gaps / flagged follow-ups

- **No automated tests.** Every "verified" note above means manually driven
  through a browser preview tool in this project's sessions. There is no
  regression safety net.
- **No settings screen.** The landlord's WhatsApp sign-off name lives only in
  `localStorage`, captured via a one-time native `prompt()`. Clearing site
  data or reinstalling the PWA loses it silently (next send just re-prompts,
  which is a graceful-enough fallback but worth knowing).
- **`README.md`** is still the unedited `create-next-app` boilerplate — no
  project-specific documentation there.
- **Git remote is misleadingly named** (`placement-tracker`, from a prior
  unrelated project). Cosmetic, but worth fixing before this goes anywhere
  public.
- **Native browser input chrome can't be localized.** The internals of
  `<input type="month">` / `<input type="date">` (spinner labels, "Show
  picker" text) render in the OS/browser locale regardless of app language.
  Known and accepted, not a bug to chase.
