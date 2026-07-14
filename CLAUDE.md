# Rental Book

A bilingual (English/Marathi) rent-tracking PWA for a small landlord managing a
handful of shops — some let to unrelated tenants, some let informally to family.
Built for a non-technical primary user (the developer's father); every screen
must stay legible, forgiving, and translated on a phone.

## Tech stack

- **Next.js 14** (App Router, TypeScript, Tailwind CSS) — mobile-first, 16px
  base font, touch targets ≥44px.
- **Dexie** (IndexedDB wrapper) — the local source of truth. Everything is
  local-first; the app works fully offline with no account.
- **Supabase** (Postgres) — *optional* cloud sync so the whole household shares
  one dataset across phones. Off unless `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY`
  are set; Dexie stays the source of truth and Supabase is a sync layer on top.
  Auth is a **single shared PIN**, not per-person logins: there's one shared
  Supabase account (fixed email `NEXT_PUBLIC_SYNC_EMAIL`, default
  `household@rental-book.app`) and the **PIN is that account's password**. See
  `docs/CLOUD_SYNC_SETUP.md`.
- **next-pwa** — offline app shell + install-to-home-screen. Disabled in dev
  (`next.config.mjs`); only generates a real service worker on `next build`.
- No test framework, no CI. All verification so far has been manual, driven
  live through a browser preview tool (see `PROGRESS.md` for what that
  actually covered).

## Data model (`lib/types.ts`)

- Every record extends **`SyncFields`**: a client-generated UUID `id` (string,
  *not* an auto-increment int — that's required for multi-device sync),
  `createdAt`, `updatedAt` (drives last-write-wins), `deletedAt` (tombstone;
  non-null = soft-deleted and hidden from all reads), and `dirty` (local-only,
  marks a row as needing a push — never sent to the server).
- **Shop** — `name`, `area` (groups shops in list views), `address?`,
  `monthlyRent`.
- **Tenant** — belongs to a `shopId`, has `type: "regular" | "family"`, and an
  `active` boolean.
- **Payment** — belongs to `shopId` + `tenantId`, `amount`, `dueMonth`
  (`"YYYY-MM"`), `datePaid` (`null` = unpaid), `paymentMode`.
- Derived: `ShopWithStatus` (shop + its active tenant + this-month payment
  status), `ShopLedger` (a shop's full payment history + synthetic "missed"
  rows), `MonthlySummary`, `MonthlyCollected`.

## Locked-in conventions — don't relitigate these without a reason

1. **One active tenant per shop, enforced by soft-deactivation.** Adding a new
   tenant to an occupied shop flips the old tenant's `active` to `false`
   rather than deleting them (`addTenant` in `lib/db.ts`). This preserves
   payment history integrity — payments still point at a valid `tenantId`.
   "Removing" a tenant without replacing them (`removeTenant`) does the same
   soft-deactivation; the shop just shows vacant.

2. **Vacant shops are excluded from every money total**, everywhere
   (`getMonthlySummary`, Dashboard summary card, Reports). Vacancy is
   surfaced separately (a neutral gray "Vacant" pill), never folded into
   collected/pending figures — a vacant shop owes nothing, so counting its
   rent as "pending" would be misleading.

3. **Family tenants get a visually softer status treatment.** An unpaid/
   partial *family* tenant shows a neutral slate pill instead of the urgent
   red/amber used for regular tenants (`StatusPill.tsx`) — these are informal
   arrangements, not overdue rent from a formal tenancy.

4. **The payment ledger is scoped per-shop, not per-tenant.** `getShopLedger`
   fetches every payment ever recorded for the shop regardless of which
   tenant it belonged to, so history survives a tenant turnover. The
   "missed month" calculation, however, only looks back to the *current*
   tenant's `createdAt` — a prior tenant's unpaid months are never
   retroactively flagged against the new tenant.

5. **i18n is mandatory for every user-facing string.** All labels go through
   `t("key")` from `useTranslation()` (`lib/translations.ts` +
   `LanguageContext.tsx`), with parallel `en`/`mr` values on every key.
   Longer templated messages (WhatsApp texts, delete-confirmation copy) are
   built as language-aware template functions instead (`lib/whatsapp.ts`,
   `lib/confirmMessages.ts`) since they need runtime interpolation.
   **Known, accepted exception:** native browser UI (the internals of
   `<input type="month">`/`<input type="date">`, and — if ever
   reintroduced — `window.confirm`/`window.prompt` button chrome) renders in
   the browser/OS locale, not the page's language, and cannot be controlled
   from application code. This is why destructive-action confirmations use a
   custom `ConfirmDialog` component instead of native `window.confirm()`.

6. **Offline-first; Dexie is the source of truth, sync is a layer on top.**
   Every screen reads/writes Dexie directly and never awaits the network.
   Optional Supabase sync (`lib/sync.ts`, `lib/supabase.ts`,
   `lib/SyncContext.tsx`) pushes local `dirty` rows and pulls remote changes,
   merging by last-write-wins on `updatedAt`. It is a strict no-op when
   unconfigured (no env vars) or signed out — never make core features depend
   on it. Auth is a shared PIN: entering it signs into the one shared account
   (`signInWithPin` = `signInWithPassword` with the fixed `SYNC_EMAIL` and the
   PIN as password); a full-screen `PinGate` prompts on first launch and the
   PIN is remembered in localStorage for silent re-auth. Two invariants that
   keep sync correct: **all writes go through the stamping helpers in
   `lib/db.ts`** (they set `id`/`updatedAt`/`dirty`), and **deletes are
   tombstones, not row removals** (`deletedAt` set; reads filter via
   `notDeleted`). A new user-facing string still follows convention #5; a new
   *table or field* must also be mirrored in `supabase/schema.sql` and the
   mapping functions in `lib/sync.ts`.

7. **next-pwa + App Router needs two manual workarounds** (both in
   `next.config.mjs`, discovered by debugging a broken install, not assumed):
   - `register: false` + a manual `ServiceWorkerRegister` component, because
     next-pwa's auto-register only injects via the Pages Router's
     `_document`.
   - `buildExcludes: [/app-build-manifest\.json$/]`, because that file is an
     internal build artifact never served as a public route under the App
     Router — precaching it 404s and fails the *entire* service worker
     install otherwise.

## Housekeeping notes

- The git remote is `github.com/adityadeshmukh23/placement-tracker` — a
  leftover name from a prior unrelated static-site project that used to live
  in this same repo. The app (originally built and shipped as "BhadeBook",
  renamed to Rental Book) fully replaced it; the repo was never renamed.
- `README.md` is still the unedited `create-next-app` boilerplate.
- See `PROGRESS.md` for what's actually built, verified, and — importantly —
  what's committed vs. still sitting uncommitted in the working tree.
