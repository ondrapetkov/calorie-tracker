# Edit Amounts in Servings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Amounts entered in servings are remembered, shown and edited in servings (with −/+ buttons) in the diary, on a logged meal's plate and in the meal editor.

**Architecture:** An optional `serving` snapshot (`{ grams, label }`) on food log entries, plate rows and saved-meal items. The count is always derived (`grams / serving.grams`). Pure helpers in `src/domain/servings.ts`, carried through the existing plate/meal functions and repo methods. UI: `AmountForm` gets an initial mode, a third `onSubmit` argument and steppers. A new shared `IngredientAmount` cell is used by both ingredient-row editors.

**Tech Stack:** React 19, Dexie, Tailwind, Vitest + fake-indexeddb, Playwright (Firefox + WebKit).

**Spec:** `docs/superpowers/specs/2026-11-17-servings-editing-design.md`

## Global Constraints

- `serving?: { grams: number; label: string | null }`; missing = entered in grams. Count = `grams / serving.grams`.
- Diary row text for a food in servings: `${count} servings · ${grams} ${unit}` (count via `formatCount`, "1 serving" for exactly 1), then the macros as now.
- Ingredient rows: unit text `serv.` when in servings, else the basis (`g`/`ml`); in servings the line under the name reads `${kcal} kcal · ${grams} ${basis}`.
- Steppers: buttons labelled `−` and `+` with aria-labels `Fewer servings` / `More servings` (rows: `Fewer <name>` / `More <name>`); ±1 serving; − never goes below 1 (at or below 1 it does nothing).
- Counts are shown with up to 2 decimals, without trailing zeros.
- No steppers in grams mode.

## Review Focus

- Switching a plate row between `serv.` and `g` without changing the amount must still save (the row's mode changed) and must not alter grams/kcal. (Test in Task 1: `plateChanged` sees a serving change; Task 4 e2e.)
- Opening and closing Edit entry / the plate editor without touching anything must not rewrite grams through rounding (4 × 33.333 g). (Task 4: unchanged text keeps the stored grams; Task 3 e2e checks kcal is unchanged after Save with no edit.)
- Logging a 2-serving recipe whose ingredient is 4 slices as 1 serving gives a plate row reading 2 servings. (Test in Task 2.)
- A food logged in grams whose food has a serving size still gets the Servings switch in Edit entry; one whose food was deleted gets grams only. (Task 3.)
- − at 1 (or 0.5) stays put; + from 1.5 gives 2.5. (Test in Task 1.)

---

### Task 1: Serving helpers and plate rules

**Files:**
- Create: `src/domain/servings.ts`, `src/domain/servings.test.ts`
- Modify: `src/domain/loggedMeal.ts`, `src/domain/loggedMeal.test.ts`

**Interfaces:**
- Produces (`servings.ts`):
  - `interface Serving { grams: number; label: string | null }`
  - `servingCount(grams: number, serving: Serving): number`
  - `formatCount(n: number): string` (≤ 2 decimals, no trailing zeros, "." decimal point as typed into inputs)
  - `stepCount(n: number, delta: 1 | -1): number` (+1 always; −1 only when `n - 1 >= 1`, else `n`)
  - `amountText(grams: number, serving: Serving | null): string` (count via `formatCount` when serving, else grams rounded to 0.1)
  - `gramsFromText(text: string, serving: Serving | null): number | null` (`parseNumber`, × `serving.grams` when serving; null when not a number > 0)
- Produces (`loggedMeal.ts`): `LoggedMealItem.serving?: Serving`, `SavedMealRow.serving?: Serving`, `FoodEntryLike.serving?: Serving`. `plateFromMeal` input rows take `serving?` and copy it. `plateFromFoodEntries` copies `serving`. `plateChanged` is also true when a row's serving differs (compare `serving?.grams`, `serving?.label`). `savedMealFromPlate`: a mapped saved item whose row changed in grams *or* serving takes the row's `serving`; new items take the row's `serving`.

- [ ] **Step 1: Write failing tests**
  - servings.test.ts: `servingCount(100, {grams:25,label:'slice'})` → 4; `formatCount` 4 → "4", 1.5 → "1.5", 1/3 → "0.33", 2.499 → "2.5"; `stepCount` 4,+1 → 5; 1.5,+1 → 2.5; 1,−1 → 1; 0.5,−1 → 0.5; 2.5,−1 → 1.5; `amountText(100, s25)` → "4", `amountText(33.33, null)` → "33.3"; `gramsFromText('6', s25)` → 150, `gramsFromText('150', null)` → 150, `gramsFromText('0', s25)` → null, `gramsFromText('x', null)` → null, `gramsFromText('1,5', s25)` → 37.5.
  - loggedMeal.test.ts: `plateFromMeal` copies a recipe row's serving and halves grams for 1 of 2 servings (row grams 50 with serving 25 → count 2); `plateFromFoodEntries` copies serving; `plateChanged` true when only `serving` differs; `savedMealFromPlate` gives a mapped item the row's new serving when only the serving changed (grams unchanged), and a new item the row's serving.
- [ ] **Step 2: Run** `npx vitest run src/domain`, expect the new tests to FAIL.
- [ ] **Step 3: Implement** the helpers and the `loggedMeal.ts` changes.
- [ ] **Step 4: Run** `npx vitest run`, expect all PASS.
- [ ] **Step 5: Commit** "Add serving helpers and carry servings through plates".

### Task 2: Store servings on entries and meal items

**Files:**
- Modify: `src/db/schema.ts` (`LogEntry.serving?: Serving`, `MealItem.serving?: Serving`, doc comments), `src/db/repo.ts`, `docs/DESIGN.md` (log_entry table row for `serving`; meal_item mention)
- Test: `src/db/repo.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `repo.logFood(params: { food; grams; date; slot; serving?: Serving | null })` stores `serving` when given.
  - `repo.updateEntry(id, changes: { grams; slot; serving?: Serving | null })`: `serving` given → set it (null removes the field); omitted → unchanged.
  - `MealInput.items[]` gains `serving?: Serving | null`, saved on add and update (null/undefined → no field). `MealDetail.items` carry it (rows are spread already).
  - `recipeRows` passes `serving`; `saveEntriesAsMeal` passes each entry's `serving` to plate rows and meal items; `updateMealEntry` passes `serving` from `savedMealFromPlate` items into `saveMeal`.

- [ ] **Step 1: Write failing tests**
  - `stores the serving a food was logged with, and changes or clears it on edit`: logFood with serving {25,'1 slice'} grams 100 → entry.serving equal; updateEntry grams 150 + same serving → serving kept, kcal ×1.5; updateEntry with `serving: null` → `entry.serving` undefined; updateEntry without serving key → unchanged.
  - `keeps ingredient servings and carries them onto a logged plate`: saveMeal (servings 2) with bread item grams 100 serving 25 → getMeal item serving; logMeal servings 1 → plate row grams 50, serving 25.
  - `carries servings through save as meal`: two entries, one with serving → plate row and meal item have it.
  - `updates a saved ingredient's serving when only the plate row's mode changed`: log meal, `updateMealEntry` with a plate row whose serving was added (grams unchanged), `updateSavedMeal: true` → saved item has the serving.
- [ ] **Step 2: Run** `npx vitest run src/db/repo.test.ts`, expect the new tests to FAIL.
- [ ] **Step 3: Implement** the schema fields, repo changes and DESIGN.md rows.
- [ ] **Step 4: Run** `npx vitest run && npx tsc -b`, expect PASS and no type errors.
- [ ] **Step 5: Commit** "Store the serving an amount was entered with".

### Task 3: Servings in the amount form, Edit entry and diary rows

**Files:**
- Modify: `src/features/add-food/AmountForm.tsx`, `src/features/add-food/AddFoodFlow.tsx`, `src/features/diary/EditEntrySheet.tsx`, `src/features/diary/DiaryScreen.tsx`
- Test: `e2e/diary.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces:
  - `AmountForm` props: new `initialMode?: 'serving' | 'amount'` (default: today's rule), and `onSubmit: (grams: number, slot: Slot, serving: Serving | null) => …`, where serving is `{ grams: servingG, label: servingLabel }` when submitted in Servings mode, else null. In Servings mode the input is flanked by `−` / `+` buttons (`stepCount`).
  - `AddFoodFlow` `pick` mode: `onPicked: (food: Food, grams: number, serving: Serving | null) => void`. The log path passes `serving` to `logFood`.
  - EditEntrySheet: `servingG`/`servingLabel` from `entry.serving`, else from the food's current `defaultServingG`/`defaultServingLabel` when the food is live (live query on `db.foods.get`, through a new `repo.getFood(id): Promise<Food | undefined>` returning undefined for deleted). `initialMode: entry.serving ? 'serving' : 'amount'`. Saves `serving` (or null) through `updateEntry`.

- [ ] **Step 1: Write failing e2e tests** (use a bundled food with a serving size: `Vejce slepičí, celé`, 50 g per `1 vejce (M)`, 143 kcal/100 g):
  - `a food logged in servings shows and edits in servings`: log 2 eggs in Servings mode → row contains `2 servings · 100 g` and `143`; open it → Servings is selected, box shows 2; tap `More servings` twice → hint `200 g in total`; Save → row `4 servings · 200 g`, `286`. Reopen and Save without changes → still `4 servings · 200 g`, `286`.
  - `a food logged in grams can be switched to servings`: log 100 g of egg in grams → row `100 g`; open → Grams selected; switch to Servings → box 2; Save → row `2 servings · 100 g`.
- [ ] **Step 2: Run** `npx playwright test e2e/diary.spec.ts`, expect the new tests to FAIL.
- [ ] **Step 3: Implement** AmountForm (mode, steppers, serving on submit), AddFoodFlow, EditEntrySheet, `repo.getFood`, and the DiaryScreen row text. Update other `onPicked` callers' signatures (MealEditor, EditMealEntrySheet) to accept and, for now, ignore the third argument.
- [ ] **Step 4: Run** `npx playwright test && npx vitest run && npx tsc -b`, expect all pass.
- [ ] **Step 5: Commit** "Show and edit logged foods in servings, with −/+ buttons".

### Task 4: Servings in ingredient rows

**Files:**
- Create: `src/features/meals/IngredientAmount.tsx`
- Modify: `src/features/diary/EditMealEntrySheet.tsx`, `src/features/meals/MealEditor.tsx`, `README.md` (feature bullet; unit and e2e test counts)
- Test: `e2e/foods-and-meals.spec.ts`

**Interfaces:**
- Consumes: Tasks 1–3 (`onPicked` third argument, helpers).
- Produces: `IngredientAmount({ name: string; basis: 'g' | 'ml'; text: string; serving: Serving | null; servingSize: Serving | null; onChange: (text: string, serving: Serving | null) => void })`. Renders, in servings: `−` (aria `Fewer <name>`), a narrow input (`!w-14`, aria `Amount of <name>`), `+` (aria `More <name>`), and a unit button `serv.`. In grams: the input as today (`!w-24`) and a unit button `g`/`ml`. The unit button (aria `Switch <name> to grams` / `Switch <name> to servings`) is a button only when `servingSize` is known (row serving, else food default), otherwise plain text. Switching converts the text with `gramsFromText` + `amountText`, so grams don't change.
- Row state in both editors becomes `{ …, text: string, serving: Serving | null }`. Rows added with a serving from the pick flow start in servings. Plate editor: a row whose `text` and `serving` are unchanged keeps the exact stored grams (generalising today's `initial` rule); `servingSize` = row serving ?? the live food's default (load the plate's foods once with `repo.getFood`). Meal editor: `servingSize` = row serving ?? `food.defaultServingG`. Under the name, rows in servings show `${kcal} kcal · ${grams} ${basis}`.
- MealEditor saves `serving` per item; EditMealEntrySheet builds plate rows with `serving`.

- [ ] **Step 1: Write failing e2e tests:**
  - `meal ingredients added in servings stay in servings`: new meal, add egg in Servings mode ×2 → row shows box 2 with `serv.` and `100 g`; tap `More <egg>` → 3, `150 g`; Done; log the meal (1 serving); open the diary entry → plate row box 3 `serv.`; tap `Switch <egg> to grams` → box 150 `g`; Done (Just this entry) → entry kcal unchanged (215).
  - Reopening the meal in the editor shows the egg row in servings (3).
- [ ] **Step 2: Run** `npx playwright test e2e/foods-and-meals.spec.ts`, expect the new test to FAIL.
- [ ] **Step 3: Implement** `IngredientAmount` and wire both editors.
- [ ] **Step 4: Update README.**
- [ ] **Step 5: Run** `npx playwright test && npx vitest run && npm run build`, expect all pass.
- [ ] **Step 6: Commit** "Edit meal and plate ingredients in servings".
