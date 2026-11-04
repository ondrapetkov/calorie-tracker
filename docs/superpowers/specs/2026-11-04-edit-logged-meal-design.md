# Editing a logged meal: design

Status: builder check done; awaiting the owner's approval. Date: 2026-11-04. Change 2 of the 10 changes toward 1.0.

## 1. Intent

While cooking a saved meal that is already logged, the owner sometimes changes it on the fly: an extra egg in the scrambled eggs, 30 g more rice on the plate. Today a logged meal can only be rescaled by servings, so the diary can't show what was actually eaten without deleting the entry and logging the parts by hand.

The owner wants to open a logged meal and edit **what is on the plate**, meaning what they are about to eat, ingredient by ingredient.

Such edits are usually one-offs for that day. Permanent recipe changes are normally made in the Meals tab. Sometimes the edit is a recipe improvement, though, so after an edit the app offers to carry it over to the saved meal.

Success: adding an egg to a logged meal takes a tap on the entry, a changed number and Done, and the diary total is right.

## 2. Goals, non-goals, anti-goals

**Goals**
- A logged meal opens to an editor of its ingredients, with the amounts **on the plate** (the entry's share of the recipe). Amounts can be changed, ingredients removed, and new ones added.
- After editing, the app asks whether to update the saved meal as well. The default and main answer is "just this entry".
- When the saved meal is updated, the plate changes are scaled up to the whole recipe (section 3.4).
- A "Don't ask again for this meal today" checkbox in that popup.

**Non-goals**
- Changing the number of servings of a logged meal. The owner said this isn't needed: the plate amounts say exactly how much is eaten. Only the servings field in the **edit** sheet goes away. Logging a meal still asks for servings, and `LogEntry.servings` stays: it is what "logged as 1 of 4" and the scale-up factor are built from. `repo.updateMealEntry` (rescale by servings) is replaced.
- Editing the meal's name, note, meal types or tags from the diary.
- Changing how foods (not meals) are logged or edited.

**Anti-goals**
- Editing a logged meal silently changing the saved meal, or any other day's entries.
- A past day's numbers changing because a food or saved meal was edited later. This is the existing snapshot rule, and it must still hold.
- The popup becoming a nag during cooking, when the owner tweaks the same meal several times. That's what the checkbox is for.

## 3. Decisions made with the owner

### 3.1 Editing the plate
- Tapping a logged meal in the diary opens **Edit entry** (mockup: `edit-logged-meal.html`, screen 1):
  - The meal's name, and a line saying how it was logged (for example "Logged as 1 of 4 servings").
  - **On your plate:** one row per ingredient, with its name, kcal and an amount field in g or ml, plus × to remove it.
  - **+ Add ingredient**, which opens the existing add-food flow in pick mode (the same one the meal editor uses).
  - A live total (kcal, protein, carbs, fat), the meal slot select, and Delete entry.
  - Close top left, the yellow Done top right. This follows change 1, extended to this sheet.
- Plate amounts are the recipe amounts × (servings logged ÷ servings the recipe makes). For a dinner logged whole, that's the full recipe.

### 3.2 The popup
- It appears after Done, only when the ingredients were changed. Changing only the slot saves without asking.
- If the saved meal has been deleted since logging, there is nothing to update: no popup, and Done saves just this entry. *(Builder check, Claude's call.)*
- Title "Also update the saved meal?", with a line explaining that the saved meal stays as it is unless chosen, and that past days never change.
- Buttons: **Just this entry** (primary, yellow) and **Update saved meal too**.
- Checkbox: **Don't ask again for this meal today.** When ticked, the chosen answer is remembered for this saved meal on this diary date. Later edits of that meal's entries dated that day apply it without asking.

### 3.3 This entry only (the default)
- The entry's ingredients and totals change. The saved meal and every other entry stay as they are.

### 3.4 Updating the saved meal: scale up (owner's rule)
- Each plate change is multiplied by **recipe servings ÷ servings logged**. "Recipe servings" is how many servings the recipe made **when the entry was logged**, stored on the entry at log time (new field), because that is what the plate was a share of. Old entries have no stored value, so they use the saved meal's servings now. *(Builder check, Claude's call.)* For example, +50 g rice on 1 serving of a 4-serving meal adds 200 g to the saved meal. On 2 of 4 servings it adds 100 g, and on a whole dinner it adds 50 g.
- Changed amount: the saved ingredient changes by (new plate amount − old plate amount) × factor.
- Removed from the plate: removed from the saved meal.
- New on the plate: added to the saved meal at plate amount × factor.
- Only the ingredient list changes. The saved meal's servings, name, note, meal types and tag adjustments stay as they are, and its ingredient tags follow the new ingredients as usual (`domain/mealTags.ts`).
- Past entries of that meal don't change. Neither does the edited entry's own "logged as" ratio.

## 4. Constraints from the existing app

- **Snapshots.** A diary entry stores its own nutrition (`LogEntry` macros), so later edits of foods or meals never rewrite past days. A logged meal now also needs its ingredient list to be editable, so the entry stores a **snapshot of its plate**: for each ingredient, the food id, the saved-meal item id it came from (if any), its name, basis (g/ml), per-100 nutrition, and the plate amount. The entry's macros are always the sum of these rows.
- **Storage and sync.** Entries sync as a whole JSON row (`records.data` jsonb in Supabase), so a new optional field on `LogEntry` needs no SQL migration. It isn't indexed, so no Dexie version bump is needed either.
- **Old entries.** Meal entries logged before this change have no plate snapshot. The first time one is opened, its plate is built from the saved meal as it is now, scaled to the entry's servings. Nothing is written until Done. *(Builder check, Claude's calls below.)*
  - If the rebuilt plate's total differs from the entry's stored total (the saved meal or its foods changed since logging), the sheet shows a short note: "The saved meal has changed since this was logged. Saving with ingredient changes uses the ingredients shown."
  - If only the slot changes (or nothing), Done keeps the stored totals and writes no snapshot, so a past day's numbers never change without an ingredient edit.
  - Ingredients whose food was deleted are soft-deleted rows that still hold their nutrition, so they are rebuilt like any other.
  - If the saved meal itself has been deleted, the entry can't be rebuilt. The sheet then shows the name and totals with only the slot and Delete, plus a short note saying why.
- **New entries.** `repo.logMeal` stores the plate snapshot and the recipe's servings when logging.
- **Units.** Ingredients keep their food's basis: g or ml.
- **Header Done.** Use `SheetDone` from `src/components/ui.tsx` (change 1). Errors go in `ErrorNote`.
- **Tests.** Domain logic (plate building, scaling, the saved-meal update) gets unit tests. The e2e suite (`e2e/`) gets a test that logs a meal, edits the plate, and checks the diary and the saved meal for both popup answers.

## 5. Left to the builder (builder's calls)

- The exact field names and module layout (for example a `LoggedMealItem` type and a pure function in `src/domain/` that turns plate edits into a new saved-meal ingredient list).
- Matching plate rows to saved-meal items: by the stored saved-meal item id. Rows added on the plate have none and become new saved-meal items. If the matching item has since been removed from the saved meal, a changed row is added back at its scaled amount.
- If a scaled saved-meal amount comes out at or below zero, the item is removed.
- Where the "don't ask again" choice is kept: on the device only (per meal id + date), not synced. It is a convenience that expires with the day.
- Validation: the plate needs at least one ingredient, and amounts must be positive numbers (same parsing as the meal editor).
- The diary row's subtitle for an edited meal entry (today it reads "1 × meal").
- The "· changed from the saved meal" line in the mockup: shown once the entry's plate has been edited (a stored flag on the entry), not computed by comparing with the saved meal. *(Builder check, Claude's call.)*
- Whether the popup is a bottom sheet or a centred dialog, as long as it matches the mockup's content.

## 6. Mockups

`.superpowers/brainstorm/38786-1793809732/content/edit-logged-meal.html`: screen 1 is Edit entry with 1 of 4 servings of "Kuřecí na asijský způsob" and the rice raised. Screen 2 is the popup after Done.
