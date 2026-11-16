# Save Logged Foods as a Meal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From the Diary, turn one logged food, or every food in a slot, into a saved meal that replaces those entries with one meal entry.

**Architecture:** A pure domain helper builds a meal plate from food entries (using each entry's own snapshot). A repo method creates the meal and swaps the entries in one Dexie transaction. A shared `SaveAsMealSheet` is opened from the Edit entry sheet (one food) and from a slot card button (all foods in the slot).

**Tech Stack:** React 19, Dexie, Tailwind, Vitest + fake-indexeddb, Playwright (Firefox + WebKit).

**Spec:** `docs/superpowers/specs/2026-11-16-save-as-meal-design.md`

## Global Constraints

- New meal: servings **1**, `slots: [<the entries' slot>]`, one ingredient per food entry at its logged amount, in logged order.
- The food entries are soft-deleted and replaced by one meal entry: `servings: 1`, `recipeServings: 1`, same date and slot, macros equal to the sum of the replaced entries.
- Sheet: title "Save as meal", Close top left, yellow `SheetDone` top right, disabled while the trimmed name is empty.
- Slot button "Save as meal" only when the slot has 2+ entries, all foods, and all of their foods still exist (not deleted). The Edit entry button only when the entry's food still exists.
- Toast after saving: `Saved as meal <name>` (no undo).

## Review Focus

- Saving the slot must keep the day's totals identical, even when a food's nutrition was edited after logging: the plate uses the entry's snapshot, not the food's current values. (Test in Task 2.)
- The new meal entry must sit where the first replaced food was in the slot, not jump to the bottom: `loggedAt` = the earliest replaced entry's. (Test in Task 2.)
- A food entry with 0 g: per-100 can't be derived; use the entry's macros as per-100 (same rule as `EditEntrySheet`). (Test in Task 1.)
- Entries from different slots/days, a meal entry, or a deleted food must be refused by the repo rather than half-saved; nothing is written. (Test in Task 2.)
- After Done from the Edit entry sheet, both sheets close (the entry being edited no longer exists). (Covered by the e2e in Task 3.)

---

### Task 1: Plate from food entries

**Files:**
- Modify: `src/domain/loggedMeal.ts`
- Test: `src/domain/loggedMeal.test.ts`

**Interfaces:**
- Produces:
  - `plateFromFoodEntries(entries: FoodEntryLike[], newId: () => string): LoggedMealItem[]` where `FoodEntryLike = Macros & { foodId: string | null; grams: number | null; unit: 'g' | 'ml'; label: string }`. Each row: `id` = `mealItemId` = `newId()`, `foodId`, `name: label`, `basis: unit`, `grams`, `per100` = entry macros × 100 / grams (entry macros as-is when grams is 0 or null).
  - `canSaveSlotAsMeal(rows: { foodId: string | null; mealId: string | null }[], liveFoodIds: Set<string>): boolean`: 2+ rows, every row has `mealId === null` and a `foodId` in `liveFoodIds`.

- [ ] **Step 1: Write failing tests** in `loggedMeal.test.ts`:
  - `builds a plate from food entries using their own snapshot`: two entries (150 g with kcal 180; 200 ml with kcal 84) → rows with `per100.kcal` 120 and 42, `grams` 150 and 200, `basis` 'g' and 'ml', names from labels, ids from `newId`, `mealItemId === id`; `plateMacros(plate).kcal` ≈ 264.
  - `uses the entry's macros as per-100 for a zero amount`: grams 0, kcal 50 → `per100.kcal` 50.
  - `offers saving a slot only for two or more live foods and no meals`: false for one food; true for two live foods; false if one row is a meal; false if a foodId is not in the set.
- [ ] **Step 2: Run** `npx vitest run src/domain/loggedMeal.test.ts`, expect FAIL (not exported).
- [ ] **Step 3: Implement both functions** in `src/domain/loggedMeal.ts` (reuse `multiplyMacros` from `./nutrition`).
- [ ] **Step 4: Run** the same command, expect PASS.
- [ ] **Step 5: Commit** "Build a meal plate from logged food entries".

### Task 2: Repo: save entries as a meal

**Files:**
- Modify: `src/db/repo.ts`
- Test: `src/db/repo.test.ts` (new `describe('save as meal')`)

**Interfaces:**
- Consumes: `plateFromFoodEntries` (Task 1); existing `saveMeal`, `fresh`, `touch`, `plateMacros`.
- Produces:
  - `repo.saveEntriesAsMeal(params: { entryIds: string[]; name: string }): Promise<{ mealId: string; entry: LogEntry }>`. In one `rw` transaction over logEntries, meals, mealItems, foods: load entries (sorted by `loggedAt`); throw `Error` and write nothing unless all exist and are live, share date and slot, are foods (`mealId === null`, `foodId` set) whose food exists and isn't deleted, and `name.trim()` is non-empty. Build the plate, `saveMeal({ name: name.trim(), servings: 1, note: null, slots: [slot], items: plate.map(r => ({ id: r.mealItemId!, foodId: r.foodId, grams: r.grams })) })`, soft-delete the entries, add a meal entry (`label` = trimmed name, `servings: 1`, `recipeServings: 1`, `items: plate`, macros `plateMacros(plate)`, `loggedAt` = earliest entry's).
  - `repo.liveFoodIds(ids: string[]): Promise<Set<string>>`: ids of foods that exist and aren't deleted.

- [ ] **Step 1: Write failing tests:**
  - `replaces a slot's foods with one meal entry and keeps the totals`: log chicken 150 g and rice 100 g to dinner, then `updateFood` chicken to different kcal; `saveEntriesAsMeal` → `entriesForDate` has one entry with `mealId`, `servings` 1, kcal equal to the two original entries' sum, `loggedAt` = first entry's; `getMeal(mealId)` has name, servings 1, slots ['dinner'], items chicken 150 / rice 100 in that order; `entry.items[i].mealItemId === meal.items[i].id`.
  - `the saved meal's plate can be edited and carried over`: after saving, `updateMealEntry(entry.id, { slot: 'dinner', plate: <rice 200>, updateSavedMeal: true })` → saved meal rice grams 200, still 2 items.
  - `refuses entries from different slots, meal entries and deleted foods, writing nothing`: each case rejects; meals count and live entries unchanged.
  - `lists only live food ids`.
- [ ] **Step 2: Run** `npx vitest run src/db/repo.test.ts`, expect the new tests to FAIL.
- [ ] **Step 3: Implement** both methods in the log-entries section of `repo.ts`.
- [ ] **Step 4: Run** `npx vitest run`, expect all PASS.
- [ ] **Step 5: Commit** "Save logged food entries as a meal that replaces them".

### Task 3: Save as meal sheet and diary entry points

**Files:**
- Create: `src/features/diary/SaveAsMealSheet.tsx`
- Modify: `src/features/diary/EditEntrySheet.tsx`, `src/features/diary/DiaryScreen.tsx`, `docs/DESIGN.md` (diary section: one paragraph on Save as meal)
- Test: `e2e/diary.spec.ts`

**Interfaces:**
- Consumes: `repo.saveEntriesAsMeal`, `repo.liveFoodIds`, `canSaveSlotAsMeal` (Tasks 1–2); `Sheet`, `SheetDone`, `ErrorNote`, `Field`, `inputCls`.
- Produces: `SaveAsMealSheet({ entries: LogEntry[]; initialName: string; onClose: () => void; onSaved: (name: string) => void })`. Shows a name input labelled "Name", the entries (label, amount, kcal) read-only and the total kcal. Done calls `saveEntriesAsMeal`, then `onSaved(trimmedName)`; on failure shows `ErrorNote` "Couldn't save the meal." and stays open.

- [ ] **Step 1: Write failing e2e tests** in `e2e/diary.spec.ts`:
  - `saves a slot of foods as a meal that replaces them`: log chicken 150 g and a second bundled food to Dinner (via Dinner's "+ Add"); slot card shows "Save as meal"; click it, fill Name "Rychlá večeře", Done → Dinner has one entry "Rychlá večeře" with "1 × meal" and the same kcal total as before; toast "Saved as meal Rychlá večeře"; Meals tab lists the meal; adding to Dinner shows it under "For dinner".
  - `saves a single logged food as a meal from Edit entry`: log one food, open it, "Save as meal", name is pre-filled with the food's name, Done → both sheets closed, the entry shows "1 × meal"; a slot with one food shows no slot-level "Save as meal" button.
- [ ] **Step 2: Run** `npx playwright test e2e/diary.spec.ts`, expect the new tests to FAIL.
- [ ] **Step 3: Build `SaveAsMealSheet`** as specified.
- [ ] **Step 4: EditEntrySheet:** below the `AmountForm`, a full-width "Save as meal" button, only when `entry.foodId` is in `useLiveQuery(() => repo.liveFoodIds([entry.foodId]))`; opens the sheet with `initialName: entry.label`. Add an `onSavedAsMeal: (name: string) => void` prop; on save close both sheets and call it.
- [ ] **Step 5: DiaryScreen:** live-query `liveFoodIds` for the day's food ids; under each slot's rows, when `canSaveSlotAsMeal(rows, ids)`, a ghost "Save as meal" button opening the sheet with `entries: rows`, `initialName: ''`. Both entry points' `onSaved` show the toast `Saved as meal ${name}`.
- [ ] **Step 6: Add the DESIGN.md paragraph.**
- [ ] **Step 7: Run** `npx playwright test && npx vitest run && npm run build`, expect all pass.
- [ ] **Step 8: Commit** "Save logged foods as a meal from an entry or a whole diary slot".
