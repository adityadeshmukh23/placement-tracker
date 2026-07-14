# Getting Rental Book live — complete setup guide

This is the full, start-to-finish walkthrough for turning the code into an app
your whole household can actually use, on their own phones, anywhere. Follow
the parts in order the first time. Assumes no prior technical background.

**What you're building, in one sentence:** a private rent-tracking app, hosted
online for free, installed like a normal app on three phones, where everyone
unlocks it with the same PIN and sees the same shared data.

**The 5 parts:**
1. One-time setup outside of code (Supabase — the shared database + PIN)
2. Put the app online, reachable from anywhere (Vercel — free hosting)
3. Running it on your own laptop going forward
4. Installing it as a home-screen app on each phone
5. Setting the PIN now, and changing it later

---

## Part 1 — One-time setup: Supabase (the shared database)

Supabase is the free service that stores everyone's data and checks the PIN.
You only do this once, ever.

### 1.1 Create a Supabase account and project

1. Go to **supabase.com** in a browser and click **Start your project** (or
   **Sign Up**).
2. Sign up with your GitHub account (click **Continue with GitHub** — simplest,
   since your code is already on GitHub).
3. Once logged in, click **New Project**.
4. Fill in:
   - **Name**: `rental-book` (or anything you like — it's just a label)
   - **Database Password**: click **Generate a password**, then copy it
     somewhere safe (a notes app). You won't type this into the app itself,
     but keep it in case you ever need direct database access.
   - **Region**: pick the one closest to you (e.g. Mumbai / South Asia, if
     listed) for the fastest speed.
5. Click **Create new project**. Wait about 1–2 minutes while it provisions —
   there's a progress screen.

### 1.2 Create the database tables

1. Once the project is ready, look at the left sidebar and click the icon that
   looks like a terminal/database labeled **SQL Editor**.
2. Click **New query**.
3. Open this file in your browser:
   `https://github.com/adityadeshmukh23/placement-tracker/blob/main/supabase/schema.sql`
   Click the **Copy raw file** button (or select all the code and copy it).
4. Paste the entire copied text into the SQL Editor box in Supabase.
5. Click **Run** (bottom right, or `Cmd/Ctrl + Enter`).
6. You should see "Success. No rows returned." Confirm it worked: click
   **Table Editor** in the left sidebar — you should now see three tables:
   `shops`, `tenants`, `payments`.

### 1.3 Create the one shared household account (this is where you set the PIN)

This step **is** setting the PIN — read it carefully.

1. In the left sidebar, click **Authentication**, then the **Users** tab.
2. Click **Add user** → **Create new user**.
3. Fill in the form:
   - **Email**: type exactly `household@rental-book.app`
     (this exact address is what the app expects by default — don't change it
     unless you also plan to edit an extra setting later, which isn't covered
     in this guide because it isn't necessary).
   - **Password**: this is your **PIN**. Choose a number that's **at least 6
     digits**, easy for everyone to remember, e.g. `293847`. Type it in this
     field. **Write this number down somewhere — this is the PIN everyone in
     the household will type into the app.**
   - **Auto Confirm User**: toggle this **ON** (important — without it, the
     account won't be usable).
4. Click **Create user**.

That's it — the PIN is now live. Keep reading; you don't type it anywhere yet.

### 1.4 Copy your project's connection details

You'll need these two values in Part 2.

1. In the left sidebar, click the gear icon **Project Settings**, then **API**.
2. You'll see two values — copy each into a notes app for a moment:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public** key (a long string starting with `eyJ...`)

Part 1 is done. Supabase is fully set up.

---

## Part 2 — Put the app online (Vercel, free hosting)

**Why Vercel:** it's built by the same company that makes Next.js (the
framework this app uses), so it needs zero configuration — it reads the code
straight from your GitHub repository and just works. The free tier is more
than enough for a household app like this.

### 2.1 Sign up for Vercel

1. Go to **vercel.com**.
2. Click **Sign Up**, then **Continue with GitHub**.
3. Authorize Vercel to access your GitHub account when prompted.

### 2.2 Import the project

1. On the Vercel dashboard, click **Add New...** → **Project** (or just **New
   Project** if that's what you see).
2. You'll see a list of your GitHub repositories. Find **placement-tracker**
   (this is the repo name — it's an old name from before this app existed, but
   it's the right one) and click **Import** next to it.
3. On the "Configure Project" screen: leave everything as-is — Vercel will
   auto-detect **Next.js** as the framework. You don't need to change any
   build settings.

### 2.3 Add the environment variables (this connects the deployed app to Supabase)

Still on that same "Configure Project" screen:

1. Find and click to expand the **Environment Variables** section.
2. Add these one at a time — type the **Name**, then the **Value**, then click
   **Add** after each one:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | the **Project URL** you copied in step 1.4 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **anon public** key you copied in step 1.4 |

   (You do **not** need to add `NEXT_PUBLIC_SYNC_EMAIL` — the app already
   defaults to the exact email you used in step 1.3.)

### 2.4 Deploy

1. Click the **Deploy** button.
2. Wait about 1–2 minutes. You'll see a build log scrolling by, then a
   "Congratulations" screen with a screenshot of your live app.
3. Click the link/button that shows your app's address — it'll look like
   `https://placement-tracker-something.vercel.app`. **Save this address** —
   this is the link everyone in the household will use.
4. Visit that address in your browser. You should see the **PIN screen** —
   confirming it's correctly connected to Supabase.

**Good to know for later:** every time you push new code to GitHub's `main`
branch, Vercel automatically re-deploys the update within a minute or two. You
never need to repeat these steps.

---

## Part 3 — Running the app on your own laptop (for your ongoing testing)

You'll come back to this any time you want to test changes before they go
live.

1. Open your terminal.
2. Navigate to the project folder:
   ```
   cd "/Users/adityadeshmukh/Desktop/ Projects/Summer_plan"
   ```
3. (Only needed the first time, or after new code is pulled that adds
   dependencies): install packages:
   ```
   npm install
   ```
4. Make sure a `.env.local` file exists in this folder with your real Supabase
   values (this file is never pushed to GitHub, so it only exists on your
   laptop — you have to create it once). If it doesn't exist:
   - Copy `.env.example` to a new file named `.env.local` in the same folder.
   - Open `.env.local` and fill in the same two values from step 1.4:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-key...
     ```
5. Start the app:
   ```
   npm run dev
   ```
6. Open **http://localhost:3000** in your browser. You'll see the same PIN
   screen — enter the PIN from step 1.3 once.
7. To stop the app, go back to the terminal and press `Ctrl + C`.

Note: your laptop's local copy and the live Vercel copy share the **same**
Supabase data, since they point at the same project — so anything you add
locally while testing will show up for real on everyone's phones too. Be
mindful of that when experimenting.

---

## Part 4 — Installing it as a home-screen app on each phone

Once the app is live (Part 2), do this on each phone. It makes the app look
and behave like a normal installed app — full screen, its own icon, works
offline — with no App Store needed.

### 4a. Your iPhone (Safari)

1. Open the **Safari** app (it must be Safari, not Chrome — only Safari can
   install home-screen apps on iPhone).
2. Type the app's address (from step 2.4, e.g.
   `https://placement-tracker-something.vercel.app`) into the address bar at
   the top, and go to it.
3. Tap the **Share** button — the square icon with an arrow pointing up,
   at the bottom of the screen (center-ish).
4. A menu slides up. Scroll down and tap **Add to Home Screen**.
5. A screen appears letting you name the icon — leave it as "Rental Book" (or
   change it) and tap **Add** in the top-right corner.
6. Go to your home screen — you'll see the new **Rental Book** icon. Tap it
   to open the app full-screen (no Safari address bar).
7. The first time it opens, you'll see the PIN screen — enter the PIN from
   step 1.3. It will remember it after that.

### 4b. Your father's iPhone (Safari)

Same steps as above — walk him through it, or do it for him:

1. Open **Safari**.
2. Type in the app's address (from step 2.4) and go to it.
3. Tap the **Share** button (square with an arrow pointing up) at the bottom
   of the screen.
4. Scroll down in the menu that appears and tap **Add to Home Screen**.
5. Tap **Add** in the top-right corner.
6. Tap the new **Rental Book** icon on the home screen.
7. Enter the PIN (from step 1.3) the first time it asks. After that, it won't
   ask again on his phone.

### 4c. Your mother's Android phone (Chrome)

1. Open the **Chrome** app.
2. Type in the app's address (from step 2.4) and go to it.
3. Tap the **three dots** (⋮) in the top-right corner of the screen.
4. Tap **Add to Home screen** (some phones show **Install app** instead —
   either one is correct, tap whichever appears).
5. A confirmation box appears — tap **Add** (or **Install**).
6. Tap the new **Rental Book** icon on her home screen (or in the app
   drawer).
7. Enter the PIN (from step 1.3) the first time it asks. After that, it won't
   ask again on her phone.

---

## Part 5 — Setting the PIN, and changing it later

### Setting it the first time

You already did this — it happened in **step 1.3** above. Whatever password
you typed when creating the `household@rental-book.app` user in Supabase
**is** the PIN. There's no separate "set PIN" step anywhere else — Supabase's
user password *is* the PIN, by design (that's what keeps this simple: one
shared login instead of individual accounts for everyone).

Once you've decided it, just tell it to your father and mother verbally (or
write it down for them) — each of them types it once, on their own phone,
during the "Add to Home Screen" first-launch step above (4b/4c, step 7).

### Changing the PIN later

If you ever want to change it (e.g. you suspect someone outside the household
knows it):

1. Go to **supabase.com**, open your project, click **Authentication** →
   **Users**.
2. Click on the row for `household@rental-book.app`.
3. A details panel opens. Look for a way to set a **new password** directly
   (Supabase's dashboard lets you do this as the project owner, without
   needing to receive an email — this account's email isn't a real inbox
   anyway).
4. Type the new PIN (6+ digits) and save.

**What happens next:** phones that are already unlocked keep working
normally — changing the PIN doesn't log anyone out immediately. The new PIN is
only needed the next time a device has to unlock again from scratch (e.g. a
new phone, or after clearing the app's data). If you want to force everyone to
re-enter the new PIN right away, open the app on each phone and tap **Sign
Out** in the "Cloud Sync" bar near the top — it'll ask for the PIN again next
time it's opened, and you tell everyone the new number.

---

## Quick reference

- **Live app address:** (fill in after Part 2 — e.g. `https://your-app.vercel.app`)
- **Shared PIN:** (fill in after Part 1.3 — keep this somewhere private, not
  in this file if you ever make the repo private-and-shared with others)
- **Supabase project:** supabase.com → your project → Authentication/Users to
  manage the PIN; SQL Editor / Table Editor to look at the raw data if needed.
- **Local dev:** `npm run dev` in the project folder, needs `.env.local` set up
  once (Part 3).
- For deeper technical detail on how sync works, see
  [`docs/CLOUD_SYNC_SETUP.md`](CLOUD_SYNC_SETUP.md).
