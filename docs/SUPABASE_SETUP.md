# Supabase setup (one time, about 10 minutes)

Supabase will hold a copy of your data so your phone and desktop stay in sync. The app keeps working offline from its local database; Supabase is only the shared copy. Everything below is free.

Dashboard wording changes from time to time. If a label is not exactly where this says, look for the closest one.

## 1. Create the account and project

1. Go to <https://supabase.com> and sign up (GitHub login or email).
2. Create an organization if asked. Choose the **Free** plan.
3. **New project**:
   - Name: `calorie-tracker`
   - Database password: generate a strong one and keep it in a password manager. The app never uses it.
   - Region: **Central EU (Frankfurt)** or the closest EU region (nearest to the Czech Republic).
4. Wait about two minutes until the project says it is ready.

## 2. Create the table and its security rules

1. In the left menu open **SQL Editor** and start a new query.
2. Paste the whole contents of [`supabase-setup.sql`](supabase-setup.sql) and press **Run**.
3. Expected result: "Success. No rows returned".
4. Open **Table Editor**, select `records`. It should show that **Row Level Security is enabled** and have no rows yet.

What it creates: one table `records` for every synced row, a trigger that stamps each change with the server's clock, security rules so a signed-in user can only see and change their own rows (the public key alone can read and write nothing), and a function `push_records` that applies "newest edit wins".

## 3. Create your login

1. **Authentication**, then **Users**, then **Add user**, then **Create new user**.
2. Enter your email and a strong password (use a password manager).
3. Tick **Auto Confirm User** if offered, so no email confirmation is needed.

## 4. Close sign-ups

1. **Authentication**, then **Sign In / Providers** (older dashboards: **Authentication**, then **Settings**).
2. Turn off **Allow new users to sign up**. Keep the **Email** provider enabled; the app signs in with email and password.

This is a second lock, not the only one: even with sign-ups open, the row-level security rules would stop strangers from reading your data. Closing sign-ups stops junk accounts.

## 5. Copy two values for the app

1. Open **Project Settings**, then **API Keys** (or the **Connect** button at the top).
2. Copy:
   - **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - **Publishable key** (starts with `sb_publishable_`). If your project only shows the older **anon** key, that one works too. If there is a "Create new API keys" button, you can use it to get a publishable key.
3. **Never** copy or share the **secret** key (`sb_secret_...`) or the legacy **service_role** key. They bypass all security.

The URL and publishable key are designed to be public: they end up inside the app, and the security rules above are what protect the data. It is safe to paste them to Claude.

Do not share: the database password, the secret / service_role key, or your login password.

## 6. What to expect on the free plan

- 500 MB of database. Years of food logs fit in a few megabytes.
- A free project is **paused after about a week with no activity**. Your data is kept; open the dashboard and press **Restore**. Using the app daily keeps it active, and the app keeps working offline while a project is paused.
- Free organizations are limited to two active projects.
- Limits change; check <https://supabase.com/pricing> before relying on a number.

## 7. In the app

The project URL and publishable key are set in `src/sync/config.ts` (they can be overridden at build time with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`). In the app open **More**, sign in with the email and password from step 3, and sync starts. The same login works on every device.
