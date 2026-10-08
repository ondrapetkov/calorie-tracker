# Security review

Reviewed 8 October 2026 (milestone 5). Scope: the app code, its dependencies, the Supabase schema and the deployment headers. A single-user app that stores personal health data on the device and in a private Supabase project.

## What is protected, and from whom

| Asset | Where | Protected by |
|---|---|---|
| Diary, weight, water, profile | IndexedDB on each device | Device lock and OS storage encryption (the app does not add its own) |
| Same data, copied | Supabase Postgres (EU) | Login (email + password), row level security, sign-ups closed |
| Login session | `localStorage` (Supabase's standard storage) | No script injection: strict CSP, no HTML injection points, no third-party scripts |
| Backup file | Wherever you save the export | You; it is plain JSON |

## Findings

### Fixed in this review
1. **No browser security headers.** Added `public/_headers` (Cloudflare Pages applies it, `npm run preview` serves the same): a strict Content Security Policy (scripts only from the app itself, no inline scripts, no `eval`; network only to the app, your Supabase project and Open Food Facts; no framing, no plugins, no form posts), HSTS, `nosniff`, no referrer, camera allowed only for the app itself, same-origin opener. The whole test suite was re-run under this policy with no violations, and the policy was confirmed to block outside fetches, inline scripts, string `eval` and outside images. The service worker and offline start still work.
2. **Database helper function reachable from the API.** The trigger function `set_server_updated_at` had default execute rights and a mutable `search_path`. It is now locked down (`docs/supabase-setup.sql`; projects created earlier run `docs/supabase-hardening.sql`). It was never exploitable for data access, but it should not be callable.
3. **Server rows were stored without a shape check.** A malformed row (only possible from your own account) could have crashed the app. Rows that are not objects with a string id and numeric times are now skipped.
4. **`.env` files were not git-ignored.** They are now, so a key could not be committed by accident.

### Checked and fine
- **Secrets.** No secret, service_role or private key in the code or in any commit. The only key in the repo is the Supabase publishable key, which is public by design. The repository is private.
- **Row level security.** Tested on PostgreSQL 16 with stand-ins for Supabase's auth: a second user sees nothing of yours, cannot update or delete it and cannot write rows as you; the logged-out role can neither read nor write; `push_records` runs with the caller's rights (`security invoker`) and cannot overwrite a newer row.
- **Injection and XSS.** No `innerHTML`, `dangerouslySetInnerHTML`, `eval`, `new Function`, `document.write` or dynamic script loading anywhere. Everything from Open Food Facts and from the server is rendered as text by React. Search text and barcodes are URL-encoded.
- **Dependencies.** `npm audit`: 0 known vulnerabilities. Versions are pinned by the lockfile.
- **Camera.** Only started by a button press; every track is stopped when you leave the screen or hide the app.
- **Storage.** `localStorage` holds only the sign-in session and one display preference. Sync state lives in IndexedDB next to the data it describes.
- **Service worker.** Precaches the app's own files only. It does not cache API responses or anything with your token.

### Accepted risks (by design)
- **Data on the device is not encrypted by the app.** Anyone who can unlock your phone or read your computer's disk can read the diary. Use a screen lock and disk encryption.
- **Your health data sits on Supabase's servers**, readable by you and, in principle, by Supabase and anyone who breaks into your account or their systems. It is not end-to-end encrypted. If that matters, stay signed out and use only the local app plus Export.
- **Session token in `localStorage`.** Standard for Supabase's browser client. The CSP and the absence of injection points are what protect it; a future dependency that loads third-party scripts would weaken that.
- **Open Food Facts sees your searches and scanned barcodes** and your IP address (no account data). That is inherent to using it.
- **The exported JSON file is unencrypted.**

## Things only you can check

1. **Supabase: sign-ups are closed** (Authentication, Sign In / Providers, "Allow new users to sign up" off). Security does not depend on it (row level security still protects the data), but it keeps strangers from creating accounts.
2. **Supabase: run `docs/supabase-hardening.sql`** in the SQL Editor once, and open **Table Editor, records** to confirm Row Level Security is enabled. If the dashboard has a Security Advisor, it should list no warnings for `records`.
3. **Use a long, unique password** for the Supabase login (a password manager). It is the main thing standing between the internet and your data. Supabase rate-limits sign-in attempts.
4. **Cloudflare: confirm the headers arrive.** After deploying, `curl -I https://<your-site>.pages.dev` should show `content-security-policy` and `strict-transport-security`. If not, the `_headers` file was not published.
5. **Keep the GitHub repository private** (it contains your Supabase project address and some body measurements in the docs and tests).
6. **Never put the Supabase secret / service_role key in the app or the repository.**

## Keeping it secure

- Run `npm audit` now and then, and update dependencies before relying on a new feature.
- Any change to what the app talks to (a new API, a map, an analytics script) needs a matching edit to the `connect-src` / `script-src` lines in `public/_headers`. Do not loosen `script-src`.
