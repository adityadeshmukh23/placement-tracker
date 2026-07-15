# Cloud sync setup

Rental Book works fully offline with no account. Cloud sync is **optional**: turn
it on and everyone in the household (e.g. you, your father, your mother) shares
one dataset from their own phone, syncing whenever any device is online. Access
is unlocked by a **single shared PIN** — no per-person logins. This guide sets
that up. It takes ~10 minutes and the Supabase free tier is enough.

## How it works (in one paragraph)

Each phone keeps its own local IndexedDB database (via Dexie) and reads/writes it
directly, so the app is always fast and works with no signal. A small sync engine
(`lib/sync.ts`) runs in the background once a device is unlocked: it **pushes**
local changes to Supabase and **pulls** other devices' changes, merging them by
"last edit wins". Deletions are soft (tombstoned) so they travel too. Behind the
scenes there is exactly **one** shared Supabase account for the whole household;
the **PIN is that account's password**, and every device signs into the same
account by entering it. Nobody manages individual usernames.

## 1. Create a Supabase project

1. Go to <https://supabase.com>, sign up, and create a new project.
2. Pick any name and a database password (you won't need the password in the app).
3. Wait for the project to finish provisioning.

## 2. Create the tables

1. In the project, open **SQL Editor → New query**.
2. Paste the entire contents of [`supabase/schema.sql`](../supabase/schema.sql)
   and click **Run**. This creates the app's tables (including `documents`, the
   metadata table behind Family Documents), a private `documents` Storage
   bucket for the actual document files, and enables Row Level Security so
   only a signed-in user can touch any of it. Already deployed before? Just
   re-run the same file — every statement is safe to run again.

## 3. Create the one shared household account (and set the PIN)

1. Open **Authentication → Users → Add user → Create new user**.
2. For **Email**, use `household@rental-book.app` (this exact address is the
   app's default — or pick your own and set `NEXT_PUBLIC_SYNC_EMAIL` to match in
   step 4).
3. For **Password**, type the **PIN** you want the household to use. This is the
   "set once" step — the password you choose here *is* the PIN everyone enters on
   their phone. It must be at least **6 characters** (Supabase's minimum), so use
   a 6+ digit code, e.g. `246810`.
4. Tick **Auto Confirm User** so no email verification is needed.
5. (Optional but recommended: under **Authentication → Providers → Email**, turn
   *off* "Enable sign-ups" so no one else can self-register.)

To change the PIN later, edit this user's password in the Supabase dashboard;
each phone will re-prompt for the new PIN the next time its session expires (or
after signing out).

## 4. Point the app at your project

1. In the project, open **Project Settings → API**. Copy:
   - **Project URL**
   - the **anon / public** API key
2. In the app folder, copy `.env.example` to `.env.local` and fill both in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
   ```

   If you used a custom email in step 3, also set
   `NEXT_PUBLIC_SYNC_EMAIL=that-email` (otherwise the default is used and you can
   omit it).
3. Restart the dev server (or rebuild/redeploy). `.env.local` is gitignored, so
   these values never get committed.

Once the env vars are present, each device shows a **PIN screen** on first
launch. Enter the shared PIN and it unlocks sync and remembers it (you won't be
asked again on that device). With the vars absent, no PIN screen appears and the
app behaves exactly as before, fully offline.

## 5. Verify sync between phones (the real test)

1. Deploy the app (or serve it on your LAN) and open it on each phone; enter the
   shared PIN on each.
2. On phone A, add a shop. Within ~20 seconds it should appear on phone B (the
   dashboard refreshes itself when a sync pulls changes).
3. Record a payment on phone B → confirm it shows on phone A.
4. **Offline test:** turn on airplane mode on phone A, add a payment, turn
   airplane mode off. It should push up and reach the others once A reconnects.
5. **Conflict test (last-write-wins):** edit the *same* shop's rent on two
   phones while one is offline, then bring it online. The edit with the later
   timestamp wins — this is expected and intentional for this app.

You can also watch rows appear live in Supabase under **Table Editor**.

## Notes & limits

- **Last-write-wins is whole-row and by wall-clock time.** If two phones edit
  the same record in the same brief window, the later save wins and the other
  edit is dropped. This is a deliberate simplification for a household app.
- **No realtime.** Changes pull in on a ~20s poll (and immediately after your own
  edits), not instantly.
- **One shared identity + one shared PIN.** Everyone is the same account by
  design, so there's no "who changed what" history. Anyone with the PIN (and the
  app) has full read/write access — that's the intended trust model for a family.
- **The PIN is remembered on each device** (in local storage) so it isn't asked
  again and so a device can re-connect on its own after its session expires. Sign
  out from the Cloud Sync bar to forget it on that device.
- Deleting the `.env.local` values cleanly turns sync back off; local data stays.
- **Family Documents (More → Family Documents) requires cloud sync.** Unlike
  the rest of the app, uploaded files live only in Supabase Storage — there's
  no offline-only fallback, so that screen shows a setup notice instead of an
  upload form until sync is configured.
