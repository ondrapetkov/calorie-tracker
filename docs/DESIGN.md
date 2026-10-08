# Calorie Tracker: Design Document

Status: draft for review. No code exists yet.

## 1. Goals and non-goals

A personal, single-user calorie and macro tracker.

**Goals**

- Log food by searching a food database or scanning a barcode, not by typing each ingredient.
- Show daily calories and macros against personal targets.
- Build and save complete meals (recipes) and log them in one tap.
- Track body weight and water intake.
- Compute target calories and macros from height, weight, age, activity and goal.
- Work primarily on an iPhone 15 Pro; also usable on Windows and Linux desktops.
- Work offline and sync between devices.
- Cost nothing to run.

**Non-goals**

- Multi-user, sharing, social features.
- App Store release or any paid Apple account.
- Full micronutrient tracking (vitamins, minerals). Fiber, sugar and salt are tracked; nothing beyond that.
- Photo-based logging.
- HealthKit or widgets (not possible in a PWA).

## 2. Decisions

| Area | Decision |
|---|---|
| Client | React + TypeScript, built with Vite, as a PWA |
| UI | Tailwind CSS with small hand-written components (shadcn/ui is not used, to avoid depending on its CLI and registry) |
| iPhone | Installed to the Home Screen from Safari |
| Desktop | Installed PWA via Chrome or Edge (or a plain browser tab) |
| Local store | Dexie (IndexedDB) is the source of truth |
| Sync | Supabase (Postgres + Auth + RLS), free tier |
| Food data | Open Food Facts first; custom foods; USDA later if needed |
| Barcode | `zxing-wasm` in the browser; manual digit entry as fallback |
| Hosting | Cloudflare Pages (static, HTTPS required for camera access) |
| Tests | Vitest for pure domain logic; Playwright for a few end-to-end flows later |

## 3. Architecture

```
React UI (features/*)
   │  reads via live queries, writes via repositories
   ▼
Repositories (src/db)  ──►  Dexie / IndexedDB   (source of truth)
   ▲                              │
   │                              │ dirty rows
Domain (src/domain)               ▼
pure functions:             Sync engine (src/sync)  ◄──►  Supabase
macros, targets, totals

Food API clients (src/api): Open Food Facts, later USDA
```

Principles:

1. **Local-first.** The UI only talks to Dexie. The network is used for food lookup and background sync, never to render a screen.
2. **Pure domain layer.** Target calculation, macro math and daily totals are plain functions with no React or database imports, so they are easy to unit test.
3. **Snapshot on log.** A log entry stores the macros it contributed at the time it was logged. Editing or re-fetching a food later never rewrites history.

Proposed layout:

```
src/
  db/          Dexie schema, repositories, migrations
  domain/      targets.ts, nutrition.ts, totals.ts (+ tests)
  api/         openFoodFacts.ts, (usda.ts later)
  sync/        engine.ts, supabaseClient.ts
  features/    diary/ add-food/ meals/ weight/ water/ settings/
  components/  shared UI
```

## 4. Data model

All times and dates below are stored as described, never as ambiguous strings.

### 4.1 Common sync fields (every synced row)

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID v4) | Generated on the client. |
| `updatedAt` | number (epoch ms) | Set on every local write. Used for last-write-wins. |
| `deletedAt` | number or null | Soft delete, so deletions sync. |
| `dirty` | 0 or 1 | Local only. Not sent to the server. |

### 4.2 Tables

**profile** (exactly one row)

`sex` ('male' | 'female'), `birthDate` (YYYY-MM-DD), `heightCm`, `activityFactor` (default 1.55), `goal` ('cut' | 'maintain' | 'bulk'), `calorieOffset` (kcal, default -400 for cut), `proteinPerKg` (default 2.0), `fatPerKg` (default 0.9), `waterGoalMl` (default 2500), `waterPresets` (array of `{label, ml}`; default Shaker 250, Sport bottle 900, Stanley 1100).

Store the birth date, not the age, so the age stays correct over time.

**food**

`source` ('off' | 'usda' | 'custom'), `externalId` (barcode or FDC id, nullable), `name`, `brand` (nullable), `basis` ('g' | 'ml'), `per100` (an object with `kcal`, `protein`, `carbs`, `fat`, and `fiber`, `sugar`, `salt`; the last three nullable, since many products omit them), `defaultServingG` (nullable), `defaultServingLabel` (nullable, e.g. "1 slice"), `lastUsedAt`, `useCount`.

All nutrition is normalised to per 100 g (or per 100 ml). A food is written to this table only when it is logged, used in a meal or favourited. Raw search results live in memory only.

**meal** (a saved recipe or template)

`name`, `servings` (how many portions the recipe makes), `note`.

**meal_item**

`mealId`, `foodId`, `grams`, `sortOrder`. Separate rows (not an embedded array) so edits to one ingredient sync independently.

**log_entry**

| Field | Notes |
|---|---|
| `date` | Local calendar day, `YYYY-MM-DD`. This is the grouping key, not a UTC timestamp. |
| `slot` | 'breakfast' \| 'lunch' \| 'dinner' \| 'snack' |
| `foodId` / `mealId` | Exactly one is set. |
| `grams` / `unit` / `servings` | Amount eaten. `grams` (with `unit` 'g' or 'ml') for a food, `servings` for a meal. |
| `kcal`, `protein`, `carbs`, `fat`, `fiber`, `sugar`, `salt` | Snapshot of what this entry contributes. The last three are nullable (unknown, not zero). |
| `label` | Display name snapshot, so the diary still reads correctly if the food is deleted. |
| `loggedAt` | Epoch ms, for ordering within a slot. |

**weight_entry**: `date`, `kg`, `measuredAt`. One entry per day is the norm; if there are several, the last one wins in charts.

**water_entry**: `date`, `ml`, `loggedAt`. Daily total is the sum of non-deleted entries.

### 4.3 Dexie indexes

- `log_entry`: `date`, `[date+slot]`
- `water_entry`: `date`
- `weight_entry`: `date`
- `food`: `externalId`, `name`, `lastUsedAt`
- `meal_item`: `mealId`
- Every table: `updatedAt`, `dirty`

## 5. Domain logic

### 5.1 Targets

```
BMR  = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5      (male, Mifflin-St Jeor)
TDEE = BMR * activityFactor
kcal = TDEE + calorieOffset
protein g = proteinPerKg * weightKg
fat g     = fatPerKg * weightKg
carbs g   = (kcal - 4*protein - 9*fat) / 4
```

Weight comes from the latest `weight_entry`. For the initial profile (male, 22, 181 cm, 87 kg, factor 1.55) this gives about 2,940 kcal at maintenance and about 2,540 kcal at -400, with protein about 174 g. The female formula uses -161 instead of +5.

These are estimates, typically within about ±10%. The UI presents them as editable starting points, not medical advice.

**Adaptive target (later milestone).** Compare the 14 to 21 day trend of weight against average logged intake. Implied TDEE is intake minus (weight change in kg times 7,700 kcal) divided by days. Suggest an adjustment to the user rather than applying one silently.

### 5.2 Nutrition math

- Entry macros = `per100 * grams / 100`, rounded for display only. Store unrounded.
- Meal macros = sum of items; per-serving = total / `servings`.
- Logging a meal creates one `log_entry` for the meal with a snapshot, not one entry per ingredient. Expanding to ingredients can be a later option.
- Daily totals = sum of non-deleted `log_entry` snapshots for the `date`.
- Fiber, sugar and salt have soft reference values only (fiber about 14 g per 1,000 kcal, salt at most 5 g, sugar shown without a target). They are displayed as progress hints, not enforced goals, and can be overridden in settings.

### 5.3 Dates

`date` fields use the device's local calendar day at logging time. A "day" changes at local midnight. A setting for a later day rollover (e.g. 04:00) is out of scope for v1.

## 6. Food search and barcodes

### 6.1 Search order

1. Local `food` table (instant, offline, ranked by `useCount` and `lastUsedAt`).
2. Open Food Facts text search via `cgi/search.pl`, in Czech (`cc=cz`, `lc=cs`), sorted by popularity (`unique_scans_n`), debounced and cancelled on new input. An optional "sold in CZ only" filter restricts results by country tag.
3. Custom food form, if nothing fits.

### 6.2 Barcode

1. Camera preview via `getUserMedia`, decoded with `zxing-wasm`.
2. Check local `food.externalId` first, then Open Food Facts `GET /api/v2/product/{barcode}`.
3. Product not found: offer to create a custom food with the barcode attached, so the next scan is instant.
4. Manual barcode entry is always available.

### 6.3 Normalising Open Food Facts data

Use the `nutriments` per-100 g fields (`energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`, `fiber_100g`, `sugars_100g`, `salt_100g`). Missing fiber, sugar or salt is stored as null and excluded from totals, so a daily total means "at least this much" when entries have gaps; the UI marks such days. Products with missing macros are shown with a warning and can be fixed by saving a custom copy. Where only kJ is present, convert at 4.184 kJ per kcal.

### 6.4 To verify before building

- Current Open Food Facts rate limits, in particular for search.
- Whether the API accepts direct browser (CORS) calls and whether a custom `User-Agent` is required. Browsers cannot set it. If direct calls are a problem, a small free Cloudflare Worker can proxy requests.
- USDA FoodData Central terms, only if it is added later. It is English-only, so Czech queries would not hit it.

## 7. Sync design

### 7.1 Approach

Offline-first, row-level, last-write-wins. Suitable because there is one user and edit conflicts across devices are rare.

### 7.2 Server schema

One generic table keeps the sync code to a single path and avoids server migrations when the client model changes:

```sql
create table records (
  user_id           uuid        not null default auth.uid(),
  entity            text        not null,   -- 'food', 'log_entry', ...
  id                uuid        not null,
  data              jsonb       not null,
  updated_at        bigint      not null,   -- client time, used for last-write-wins
  deleted_at        bigint,
  server_updated_at timestamptz not null default now(),  -- set by trigger, used as pull cursor
  primary key (user_id, entity, id)
);
alter table records enable row level security;
create policy "own rows" on records
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

A trigger sets `server_updated_at = now()` on every insert and update. Public sign-ups are disabled in the Supabase dashboard, so only the one account can ever exist.

### 7.3 Protocol

1. **Push.** Select rows with `dirty = 1`, upsert them in batches. The upsert only overwrites a server row if the incoming `updated_at` is greater. Clear `dirty` on success.
2. **Pull.** Fetch rows where `server_updated_at > cursor`, ordered by it, in pages. For each, apply locally only if its `updated_at` is greater than the local row's. Store the new cursor.
3. **Triggers.** On app start, on regaining connectivity, after local writes (debounced), and on a manual "Sync now" button. No realtime subscription in v1.

The pull cursor uses the server clock on purpose, so a device with a wrong clock cannot make rows invisible to other devices. Client clocks only break ties between conflicting edits.

### 7.4 Rules

- Deletes are soft (`deletedAt`) and propagate like any other edit. A periodic purge of rows deleted more than 90 days ago can come later.
- The first sync on a new device pulls everything.
- The sync status (last sync time, pending count, last error) is visible in settings.
- A JSON export and import of all tables is the backup. It is independent of Supabase.

### 7.5 Security

- The anon key and project URL are public in the web bundle. That is expected; protection is entirely RLS plus disabled sign-ups.
- Use email and password or a magic link. Keep the session in Supabase's default storage.
- Do not log or embed any personal data in the repository.

## 8. Screens

Mobile uses a bottom tab bar; desktop widths use a sidebar. Same routes.

1. **Today (diary).** Date switcher (weeks start on Monday wherever a week is shown); calorie ring or bar against target; protein, carbs and fat progress; entries grouped by slot; swipe or tap to edit or delete; water and weight quick-glance.
2. **Add food.** Search box with recent and frequent foods; scan button; tabs for Foods and Meals; custom food entry. Selecting a food opens an amount editor (grams or serving) with live macros.
3. **Meals.** List of saved meals; editor with ingredient search, grams per item, servings count and live totals; "log this meal" with a servings multiplier.
4. **Weight.** Quick add; line chart with a 7-day moving average; list of entries.
5. **Water.** One-tap buttons for the configured presets (Shaker 250 ml, Sport bottle 900 ml, Stanley 1100 ml), a custom amount, daily total against goal, undo. Presets are editable in settings.
6. **Targets and profile.** Profile fields, goal switch (cut / maintain / bulk), the computed targets with an explanation of the numbers, and manual overrides.
7. **Settings.** Sync account and status, export and import, units (metric only in v1), install hint.

## 9. PWA and platform notes

- Web app manifest and a service worker (via `vite-plugin-pwa`) precache the app shell so it opens offline.
- iOS: install from Safari via Share, "Add to Home Screen". Camera access requires HTTPS and a user gesture. Home Screen apps keep their storage far more reliably than Safari tabs, but treat the Supabase copy and JSON export as the real backup.
- Call `navigator.storage.persist()` where available, and show a warning in settings if storage is not persistent.
- Safari has no `BarcodeDetector`, hence the WASM decoder.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Barcode decoding is slow or unreliable in Safari | Do the scanner spike first; manual entry fallback; tune resolution and frame rate |
| Open Food Facts data is incomplete or wrong | Warn on missing macros; easy custom copies; verify against labels for staples |
| Open Food Facts search rate limits or CORS | Debounce and cache; local-first search; Cloudflare Worker proxy if needed |
| iOS evicts storage | Home Screen install, persistent storage request, Supabase sync, JSON export |
| Free-tier changes at Supabase or Cloudflare | Data model is plain and exportable; sync layer is isolated in `src/sync` |
| Supabase pauses an inactive free project | Daily use keeps it active; the app still works offline from local data |
| Czech generic foods are poorly covered | Custom foods and saved meals for the regular diet |

## 11. Milestones

1. **Scanner spike.** Vite PWA with a single scan page, deployed to HTTPS, tested on the iPhone.
2. **Core log.** Dexie schema, food search (Open Food Facts), add to a day, daily totals, offline.
3. **Meals and targets.** Meal editor, logging meals, profile and macro targets, goal switch.
4. **Weight and water.** Logging, charts, quick-add.
5. **Sync.** Supabase project, auth, RLS, the sync engine, status UI, JSON export and import.
6. **Polish.** PWA install flow, empty states, dark mode, the adaptive target.

## 12. Resolved decisions

1. Meal slots are breakfast, lunch, dinner and snack.
2. Fiber, sugar and salt are stored from the start (nullable per food, snapshotted per log entry).
3. Metric units only (kg, cm, g, ml).
4. Water presets: Shaker 250 ml, Sport bottle 900 ml, Stanley 1100 ml, editable in settings.
5. Weeks start on Monday (weekly averages and summaries).

## 13. Progress

- Milestone 1 (scanner spike): done and verified on iPhone.
- Milestone 2 (core log): implemented. Diary with day totals, food search (saved foods, then Open Food Facts), barcode scan, custom foods, entry editing with undo, a Foods tab and JSON export.
