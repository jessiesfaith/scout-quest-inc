# Scout Quest Inc — Deploy Setup Walkthrough (your part)
*The click-by-click for the pieces only you can do. ~20–30 min. Do these in order.*

---

## Step 1 — Create the Supabase project
1. Go to **supabase.com** → **Start your project** → sign in (use **Continue with GitHub** so it's linked to your repos).
2. **New project.** Pick your org (create one if asked — name it "Scout Quest Inc").
3. Fill in:
   - **Name:** `scout-quest-inc`
   - **Database Password:** click Generate, then **save it in your password manager.** (You won't need it for the app, but keep it.)
   - **Region:** pick the one closest to you / your users (e.g. West US or East US).
   - **Plan:** Free.
4. Click **Create new project** and wait ~2 minutes while it provisions.

## Step 2 — Get the keys (the new key names)
1. In the project, open **Settings** (gear icon) → **API Keys**.
2. Copy and keep these three:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **Publishable key** (`sb_publishable_…`) — browser-safe.
   - **Secret key** (`sb_secret_…`) — if it's not shown, click to create it. **Server-only — treat like a password.**
   - *(You may also see legacy `anon` / `service_role` keys — you can ignore those; the new ones replace them.)*

> ⚠️ **Security:** the **Secret key** must never go in chat, in the browser, or in the repo. You'll paste it **only** into Vercel's environment-variable field in Step 6. The Publishable key and URL are safe to share.

## Step 3 — Lock down sign-in (invite-only)
1. **Authentication** → **Sign In / Providers** → make sure **Email** is enabled.
2. **Authentication** → **Sign-ups** (or Auth **Settings**) → turn **OFF** "Allow new users to sign up." This makes it invite-only.
3. **Authentication** → **Users** → **Add user** → enter **your email** + a password. This is your Owner account (created manually since public sign-up is off).

## Step 4 — Turn on 2FA (Supabase account)
- Top-right avatar → **Account Settings** → **Security** → enable **Multi-Factor Authentication**. (Constitution §5 — security-critical.)

## Step 5 — Hand these three to me / Claude Code
Send me (safe to share): **Project URL**, **Publishable key**, and **your Owner email.**
- With those, Claude Code builds the Stage 1 app in your repo and gives you **migration SQL**.
- **Do NOT send the Secret key or DB password** — those never leave your password manager / Vercel.

*(Claude Code builds the app → you'll get a block of SQL to paste into Supabase **SQL Editor** → **Run**. That creates the tables. No password sharing needed.)*

---

## Step 6 — Create the Vercel project (after the app is in the repo)
1. Go to **vercel.com** → **Sign in with GitHub.**
2. **Add New… → Project** → find your repo → **Import.** (If it's not listed, click "Adjust GitHub App permissions" and grant access to the repo.)
3. **Configure Project:**
   - If the app lives in a subfolder (e.g. `apps/company-os`), set **Root Directory** to that folder.
   - Framework preset: **Next.js** (auto-detected).
4. **Environment Variables** — add these three (Name = Value):
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = `sb_publishable_…`
   - `SUPABASE_SECRET_KEY` = `sb_secret_…`  ← **do NOT prefix this one with `NEXT_PUBLIC_`.** The `NEXT_PUBLIC_` prefix is what exposes a var to the browser; the secret must stay server-side.
5. Click **Deploy.** You'll get a live URL in a minute or two.

## Step 7 — Turn on 2FA (Vercel account)
- **Settings → Authentication** → enable **Two-Factor Authentication.**

## Step 8 — Test the loop
Open the URL → sign in with your Owner account → go to HR → Team → add a teammate → **reload the page.** If they're still there, the whole thing works, and we move to Stage 2.

---

### The order, in one line
Supabase project + keys + invite-only + owner user  →  send me URL + publishable key + owner email  →  Claude Code builds the app + gives migration SQL  →  you run the SQL  →  create Vercel project + env vars + deploy  →  test.

*Sources: Supabase API-keys docs (supabase.com/docs/guides/getting-started/api-keys); Vercel Git/deploy docs (vercel.com/docs/git).*
