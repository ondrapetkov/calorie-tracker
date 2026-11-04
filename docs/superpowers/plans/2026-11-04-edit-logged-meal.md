# Editing a Logged Meal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A logged meal opens to an editor of what's on the plate. After Done, the app asks whether to update the saved meal too, and if so scales the plate changes up to the whole recipe.

**Architecture:**
- **Plate snapshot on the entry.** A meal `LogEntry` gains `items` (the plate: per-ingredient snapshots with nutrition), `recipeServings` (recipe servings at log time) and `plateEdited`. Its macros are always the plate's sum.
- **Pure rules in `src/domain/loggedMeal.ts`.** Building a plate from a saved meal, totalling it, detecting a change, and turning plate edits into a new saved-meal ingredient list.
- **Repo wiring.** `repo.mealEntryPlate` returns the plate, rebuilding it for old entries. `repo.updateMealEntry` saves the plate and, if asked, the saved meal, in one transaction.
- **UI.** A new `EditMealEntrySheet` with the plate rows, the header Done and an `UpdateSavedMealDialog`. The "don't ask again" answer is kept in `localStorage`.

**Tech Stack:** TypeScript (strict), React 19, Tailwind 4, Dexie 4, Vitest + `fake-indexeddb`, Playwright (`e2e/`).

**Spec:** `docs/superpowers/specs/2026-11-04-edit-logged-meal-design.md`

## Global Constraints

- **Snapshots.** Editing a logged meal never changes another entry. Updating a saved meal never changes any entry. A past day's totals change only when that entry's ingredients are edited.
- **Storage.**
  - The new `LogEntry` fields are optional (`items?`, `recipeServings?`, `plateEdited?`). Entries logged before this change, or synced from an older app, lack them.
  - No Dexie version bump (the fields aren't indexed). No Supabase change (entries sync as a JSON row).
- **Scale factor.** It is `recipeServings ÷ entry.servings`, where `recipeServings` is the entry's stored value, or the saved meal's servings now for old entries.
- **Amounts.** Parse with `parseNumber` (`src/domain/numbers.ts`), which accepts a decimal comma. Every plate amount must be > 0, and there must be at least one ingredient. Round amounts written to the saved meal to 0.1 g.
- **Header.**
  - Close is top left. Done is via `SheetDone` (`src/components/ui.tsx`). Form errors go in `ErrorNote`.
  - No bottom save button on this sheet.
- **Copy, verbatim from the spec.**
  - Popup title: "Also update the saved meal?"
  - Popup buttons: "Just this entry" (primary) and "Update saved meal too".
  - Popup checkbox: "Don't ask again for this meal today".
  - Section label: "On your plate".
  - Old-entry note: "The saved meal has changed since this was logged. Saving with ingredient changes uses the ingredients shown."
- **The servings field disappears only from the edit sheet.** Logging still asks for servings (`MealServingsForm` stays for logging), and `LogEntry.servings` stays.

## Review Focus

1. **Remembered "update" across several edits the same day:** an ingredient added on the plate must not be added to the saved meal twice on the second edit. This is pinned in Task 2 (plate rows get linked to the new saved-meal item ids).
2. **Old entry whose saved meal changed since logging, slot-only edit:** the stored totals stay exactly the same (Task 2).
3. **Fractional servings** (1.5 of 4): factor 4/1.5, saved amounts rounded to 0.1 g (Task 1).
4. **Decimal comma in plate amounts** ("1,5"), and an emptied or zero amount: parsed, or refused with an error (Task 4).
5. **Saved meal deleted after logging:** a new-style entry is still fully editable with no popup, and an old entry falls back to slot and delete only (Tasks 2 and 4).

---

### Task 1: Plate rules (domain)

**Files:**
- Create: `src/domain/loggedMeal.ts`
- Test: `src/domain/loggedMeal.test.ts`

**Interfaces:**
- Consumes: `Macros`, `scaleMacros` (`src/domain/nutrition.ts`), `mealTotal` (`src/domain/meals.ts`)
- Produces:
  ```ts
  export interface LoggedMealItem {
    id: string                 // stable row id within the plate (crypto.randomUUID())
    mealItemId: string | null  // the saved-meal item it maps to; null for rows added on the plate and not yet carried over
    foodId: string
    name: string
    basis: 'g' | 'ml'
    per100: Macros
    grams: number              // amount on the plate, g or ml
  }
  export interface SavedMealRow { id: string; foodId: string; grams: number }
  export function plateFromMeal(
    items: { mealItemId: string; foodId: string; name: string; basis: 'g' | 'ml'; per100: Macros; grams: number }[],
    recipeServings: number, servingsLogged: number,
  ): LoggedMealItem[]                       // grams × servingsLogged / recipeServings
  export function plateMacros(plate: LoggedMealItem[]): Macros   // = mealTotal over the rows
  export function plateChanged(before: LoggedMealItem[], after: LoggedMealItem[]): boolean
  export function scaleFactor(recipeServings: number, servingsLogged: number): number
  export function savedMealFromPlate(
    saved: SavedMealRow[], before: LoggedMealItem[], after: LoggedMealItem[], factor: number,
  ): { items: SavedMealRow[]; plate: LoggedMealItem[] }
  ```
  `savedMealFromPlate` returns the new saved-meal ingredient list in saved order, with new rows appended, plus `after` with `mealItemId` filled in for rows that were carried over.

- [ ] **Step 1: Write the failing tests** in `src/domain/loggedMeal.test.ts`:
  - `plateFromMeal` with 1 of 4 servings turns 600 g rice into 150 g. With 4 of 4 it keeps 600 g. Ids are unique and `mealItemId` is copied.
  - `plateMacros` equals `mealTotal` of the same rows. Fiber stays `null` when no row has fiber.
  - `plateChanged`: false for an identical copy. True when an amount changes, when a row is removed, and when a row is added.
  - `scaleFactor(4, 1) === 4`, `scaleFactor(4, 2) === 2`, `scaleFactor(4, 4) === 1`.
  - `savedMealFromPlate`, owner's example: rice row 150 → 200 on 1 of 4 servings (factor 4) turns saved rice 600 into 800.
  - Factor 4/1.5 with a +10 g change adds 26.7 g (rounded to 0.1).
  - A row removed from the plate removes its saved item.
  - A new plate row (mealItemId null, 30 g, factor 4) appends a saved row with 120 g and a fresh id. The returned plate row has `mealItemId` set to that id.
  - A changed row whose saved item no longer exists is appended at `after.grams × factor`.
  - A change that takes a saved amount to ≤ 0 removes that item.
  - An unchanged row whose saved item is gone is left out, and nothing is added for it.

- [ ] **Step 2: Run them to verify they fail**
  Run: `npx vitest run src/domain/loggedMeal.test.ts`
  Expected: FAIL, module not found.

- [ ] **Step 3: Implement the functions in `src/domain/loggedMeal.ts`.** Match `before` and `after` rows by `id`, and match plate rows to saved rows by `mealItemId`. New saved rows get `crypto.randomUUID()`.

- [ ] **Step 4: Run them to verify they pass**
  Run: `npx vitest run src/domain/loggedMeal.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**
  `git add src/domain/loggedMeal.ts src/domain/loggedMeal.test.ts && git commit -m "Add the rules for a logged meal's plate and carrying plate edits over to the saved meal"`

### Task 2: Store the plate and save edits (repo)

**Files:**
- Modify: `src/db/schema.ts` (`LogEntry`)
- Modify: `src/db/repo.ts`: `logMeal` (~line 246), `updateMealEntry` (~line 267), and `saveMeal` (~line 281). In `saveMeal`, a given item `id` that doesn't exist yet is used as the new row's id.
- Test: `src/db/repo.test.ts`. Replace the test "logs a meal as one entry with a snapshot and rescales it when servings change" (~line 155).

**Interfaces:**
- Consumes: everything from Task 1.
- Produces:
  ```ts
  // LogEntry additions (all optional):
  items?: LoggedMealItem[]; recipeServings?: number; plateEdited?: boolean

  export interface MealEntryPlate {
    plate: LoggedMealItem[]
    recipeServings: number
    rebuilt: boolean            // built from the saved meal now (old entry)
    differsFromStored: boolean  // rebuilt and plateMacros(plate).kcal differs from entry.kcal by more than 0.5
    savedMealExists: boolean
  }
  repo.mealEntryPlate(entryId: string): Promise<MealEntryPlate | null>  // null: old entry whose saved meal is gone
  repo.updateMealEntry(id: string, changes: { slot: Slot; plate?: LoggedMealItem[]; updateSavedMeal?: boolean }): Promise<void>
  ```
  The new `updateMealEntry` replaces the servings-based one (its `servings` parameter goes away). `servings` is never changed.

- [ ] **Step 1: Write the failing tests** in `describe('meals')`, using the existing `setup()` meal ("Kuře s rýží"):
  - `logMeal` stores `items` equal to `plateFromMeal(...)`, `recipeServings` equal to the meal's servings, and kcal equal to `plateMacros(items).kcal`.
  - `updateMealEntry` with a changed plate and no `updateSavedMeal` changes the entry's macros, `items`, `plateEdited: true` and slot. `getMeal` is unchanged. A second entry of the same meal is unchanged.
  - With `updateSavedMeal: true`, the plate rice change on 1 of 2 servings is ×2 in `getMeal(mealId).items`. A second identical call that adds nothing new doesn't duplicate items. A row added in edit 1 and changed in edit 2 updates the same saved item (Review Focus 1).
  - Old entry (delete `items` and `recipeServings` from the row via `db.logEntries.update`), then change the saved meal's servings. `mealEntryPlate` returns `rebuilt: true`, uses the current servings, and gives the right `differsFromStored`. `updateMealEntry(id, { slot: 'lunch' })` with no plate keeps kcal exactly and writes no `items` (Review Focus 2).
  - Saved meal deleted: a new-style entry gives `mealEntryPlate` with `savedMealExists: false`, and `updateMealEntry` with a plate and `updateSavedMeal: true` changes only the entry. An old entry gives `null`.

- [ ] **Step 2: Run them to verify they fail**
  Run: `npx vitest run src/db/repo.test.ts`
  Expected: the new tests FAIL.

- [ ] **Step 3: Implement.**
  - `logMeal` builds the plate with `plateFromMeal` from `getMeal(...).items` (skipping items without a food, as `loadMeal` does). Its macros come from `plateMacros`.
  - `updateMealEntry` runs in one Dexie transaction over `logEntries`, `meals`, `mealItems` and `foods`. The `before` plate is `mealEntryPlate`'s plate.
  - For the saved meal, pass `savedMealFromPlate(...).items` to `saveMeal` with the meal's current name, servings and note (slots and tag changes left out, so they're kept). Store the returned linked plate on the entry.

- [ ] **Step 4: Run all unit tests**
  Run: `npm test`
  Expected: PASS. The old servings test is gone, and nothing else references `updateMealEntry`'s `servings`.

- [ ] **Step 5: Commit**
  `git commit -am "Store a logged meal's plate and save plate edits, optionally scaled onto the saved meal"` (add the test file if it's new to the index).

### Task 3: Remember the popup answer for the day

**Files:**
- Create: `src/features/diary/mealUpdateChoice.ts`
- Test: `src/features/diary/mealUpdateChoice.test.ts`. The Vitest `include` is `src/**/*.test.ts`, so it's picked up.

**Interfaces:**
- Produces:
  ```ts
  export type MealUpdateChoice = 'entry' | 'meal'
  export function rememberedChoice(store: Pick<Storage, 'getItem'>, mealId: string, date: string, today: string): MealUpdateChoice | null
  export function rememberChoice(store: Pick<Storage, 'getItem' | 'setItem'>, mealId: string, date: string, today: string, choice: MealUpdateChoice): void
  ```
  - One `localStorage` key, `meal-update-choices`, holds `{ savedOn: string, choices: Record<string, MealUpdateChoice> }` keyed by `${mealId}|${date}`.
  - When `savedOn !== today`, the stored answers count as empty and are overwritten on the next write.
  - Callers pass `localStorage` and `localDate()`, wrapped in try/catch so a blocked store means "ask".

- [ ] **Step 1: Write the failing tests** with a `Map`-backed fake store:
  - Nothing stored gives null.
  - Remember 'entry', then read it back for the same meal and date. A different meal or a different date gives null.
  - Remembered with today '2026-11-04', read with today '2026-11-05', gives null.
  - Corrupt JSON gives null and doesn't throw.

- [ ] **Step 2: Run them to verify they fail**
  Run: `npx vitest run src/features/diary/mealUpdateChoice.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement both functions.**

- [ ] **Step 4: Run them to verify they pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit**
  `git add src/features/diary/mealUpdateChoice.* && git commit -m "Remember the update-saved-meal answer for a meal and day"`

### Task 4: The Edit entry sheet for a logged meal and the popup

**Files:**
- Create: `src/features/diary/EditMealEntrySheet.tsx`
- Create: `src/features/diary/UpdateSavedMealDialog.tsx`
- Modify: `src/features/diary/EditEntrySheet.tsx`. Remove `EditMealEntry` and its `MealServingsForm` use, and render `EditMealEntrySheet` for `entry.mealId !== null`.
- Modify: `src/features/diary/DiaryScreen.tsx` (~line 93). The meal entry subtitle becomes `"1 × meal · edited"` when `plateEdited`.
- Test: `e2e/foods-and-meals.spec.ts`

**Interfaces:**
- Consumes:
  - `repo.mealEntryPlate`, `repo.updateMealEntry` (Task 2)
  - `plateMacros`, `plateChanged`, `LoggedMealItem` (Task 1)
  - `rememberedChoice`, `rememberChoice` (Task 3)
  - `AddFoodFlow` in `{ kind: 'pick' }` mode
  - `MacroPreview`, `SheetDone`, `ErrorNote`
- Produces:
  ```tsx
  EditMealEntrySheet({ entry, onClose, onDeleted }: same Props as EditEntrySheet)
  UpdateSavedMealDialog({ mealName, onAnswer }: { mealName: string; onAnswer: (choice: MealUpdateChoice, remember: boolean) => void })
  ```

**Sheet layout (mockup `edit-logged-meal.html`, screen 1):**
- **Header and summary.** The title is "Edit entry". Below it come the meal name and "Logged as {servings} of {recipeServings} servings", with "· changed from the saved meal" appended when `entry.plateEdited`. The old-entry note (Global Constraints) shows when `differsFromStored`.
- **"On your plate" rows.** Each has the name, kcal, an amount input labelled `Amount of {name}` (as in `MealEditor`), the basis, and × labelled `Remove {name}`.
- **Adding a row.** "+ Add ingredient" opens the pick flow. The new row gets `id: crypto.randomUUID()`, `mealItemId: null`, and the food's name, basis and per100.
- **Below the rows.** The live total via `MacroPreview`, the "Meal" slot select, then "Delete entry" (danger), deleting as today.
- **Fallback when `mealEntryPlate` is `null`.** Name and totals, a note that the saved meal was deleted so its ingredients can't be shown, the slot select, Delete, and Done (slot only).

**On Done:**
1. Validate: at least one row and every amount > 0, or show "Add at least one ingredient, each with an amount above 0." in `ErrorNote`.
2. If `!plateChanged` (relative to `mealEntryPlate`'s plate), call `updateMealEntry(id, { slot })` and close.
3. Otherwise, with no saved meal (`!savedMealExists`), save with `updateSavedMeal: false`.
4. Otherwise, with a remembered choice, apply it.
5. Otherwise, show the dialog. On answer, `rememberChoice` if the box was ticked, then save with `updateSavedMeal: choice === 'meal'`.

`busy` disables Done while saving.

**Dialog:**
- A bottom sheet over the editor, `role="dialog"`, with the title, buttons and checkbox copy from Global Constraints.
- The line under the title reads: "\"{mealName}\" in the Meals tab stays as it is unless you choose to update it. Past days never change."

- [ ] **Step 1: Write the failing e2e test** in `e2e/foods-and-meals.spec.ts`, named `edits a logged meal portion and optionally updates the saved meal`:
  - Create meal "Rýže s kuřetem" with 200 g of the bundled chicken (120 kcal per 100 g) and servings 2.
  - Log 1 serving: the diary entry shows `120`.
  - Tap the entry. The field `Amount of Kuřecí prsa bez kůže, syrová` shows `100`. Fill `150`, tap Done, then "Just this entry". The diary entry shows `180` and `· edited`.
  - Meals tab: open the meal, then Edit. The chicken amount is still `200`. Close.
  - Diary: tap the entry. Clear the amount and tap Done: the error alert shows.
  - Fill `160` and tap Done. Tick "Don't ask again for this meal today", then "Update saved meal too". The diary shows `192`, and the saved meal's chicken is `220` (200 + (160 − 150) × 2).
  - Tap the entry, fill `170,5` (decimal comma) and tap Done. No dialog appears (the answer is remembered). The diary shows `205`, and the saved meal's chicken is `241`.

- [ ] **Step 2: Run it to verify it fails**
  Run: `npx playwright test e2e/foods-and-meals.spec.ts`
  Expected: FAIL at the first plate assertion.

- [ ] **Step 3: Implement the sheet, the dialog, the `EditEntrySheet` switch and the diary subtitle.**

- [ ] **Step 4: Run the full checks**
  Run: `npx tsc -b && npm test && npm run e2e`
  Expected: all PASS in both browsers.

- [ ] **Step 5: Commit**
  `git add -A src e2e && git commit -m "Edit a logged meal's plate from the diary, with an offer to update the saved meal"`

### Task 5: Docs

**Files:**
- Modify: `README.md`, the "Saved meals" bullet under **Logging** (~line 26), and the unit test count under **Testing**.

- [ ] **Step 1: Update the README.**
  - Add one sentence: a logged meal can be edited ingredient by ingredient ("what's on the plate"), and the app offers to carry the change over to the saved meal, scaled to the whole recipe.
  - Update the unit test count to the new total from `npm test`.
  - Add the new e2e flow to the end-to-end list.

- [ ] **Step 2: Commit**
  `git commit -am "Document editing a logged meal"`
