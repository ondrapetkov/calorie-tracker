# Tags for meals and foods: design

Status: builder check done; awaiting the owner's approval of this document. Date: 2026-11-03.

## 1. Intent

The owner's meal list will grow, and meal names follow no naming convention ("Kuře na asijský způsob", "Chicken curry", "Kuřecí wrap"). Over time this makes a specific meal hard to find. Product names differ too: several rice products carry entirely different names. Tags give meals and foods a fixed vocabulary that does not depend on naming:

- **Finding a meal:** tap "Chicken" and "Lunch" and the list shrinks to a small pool.
- **Cooking from what is at home:** select the ingredient tags you have and see the meals that use them.
- **Building a meal:** a tag on a meal ("Rice") leads straight to the rice foods already stored, whatever they are called.

Success is that a tag is almost always picked from the built-in list. Creating a tag should be rare.

## 2. Goals, non-goals, anti-goals

**Goals**
- Meals carry meal-type tags (the four diary slots) and ingredient tags. Foods carry ingredient tags.
- The Meals and Foods tabs filter by tags with tappable chips.
- Logging from a diary slot shows that slot's meals first.
- The meal editor turns ingredient tags into "Choose {tag}" placeholders, and adding an ingredient tags the meal automatically.
- A large built-in tag list in English, grouped. The owner can add tags and groups, and rename or delete them.
- Tags sync between devices.

**Non-goals**
- Automatic tagging of existing meals and foods (an "Untagged" filter helps the owner do it by hand instead).
- Tags on diary entries, statistics by tag, or tag-based suggestions.
- Translating the tag list into Czech.

**Anti-goals** (things that would make this a failure even if it works)
- Tagging becoming a chore: extra screens, required fields, confirmation dialogs.
- Inconsistent tags creeping in (the "kuře / kuřecí / chicken" problem). The picker must make the existing tag the easiest choice.
- A rename on one device being undone by another device.

## 3. Decisions made with the owner

### 3.1 Meal-type tags
- These are exactly the diary slots (`SLOTS` / `SLOT_LABELS` in `src/domain/nutrition.ts`): Breakfast, Lunch, Dinner, Snack.
- A meal can have any number of them. None is required.
- They are stored separately from ingredient tags (they are not part of the tag vocabulary and cannot be renamed or deleted).

### 3.2 Built-in ingredient tags
The rule: a tag groups foods you would swap for each other in a meal. All chicken cuts are "Chicken". Salmon and cod differ, so they get separate tags. The agreed list, by group:

- **Meat:** Chicken, Turkey, Beef, Pork, Ham, Sausage, Bacon
- **Fish & seafood:** Salmon, Tuna, White fish, Shrimp
- **Eggs & dairy:** Eggs, Milk, Quark, Skyr, Yogurt, Cottage cheese, Cheese, Cream, Butter
- **Plant protein:** Lentils, Chickpeas, Beans, Tofu
- **Supplements:** Protein powder
- **Grains & starches:** Rice, Pasta, Noodles, Potatoes, Sweet potatoes, Bread, Tortilla, Oats, Cereal, Quinoa, Buckwheat, Couscous, Flour
- **Vegetables:** Peppers, Tomatoes, Cucumber, Onion, Garlic, Broccoli, Cauliflower, Leafy greens, Lettuce, Zucchini, Carrot, Mushrooms, Cabbage, Corn, Peas, Pumpkin, Beetroot, Avocado, Mixed vegetables
- **Fruit:** Apple, Banana, Berries, Citrus, Stone fruit, Tropical fruit, Grapes, Dried fruit
- **Nuts & seeds:** Nuts, Peanut butter, Seeds
- **Extras:** Oil, Sauce, Honey & sugar, Chocolate, Sweets, Snacks, Drinks, Fast food

Built-in tags and groups ship in the app code (like `src/data/genericFoods.ts`). Each has a stable id (for example `chicken`, `group:meat`). The owner cannot rename or delete them.

All 90 bundled basic foods in `src/data/genericFoods.ts` get their tags in code (for example `chicken-breast-raw` → Chicken). When one of them is saved to the owner's foods, its tags are copied onto the saved food.

### 3.3 The owner's own tags and groups
- **Creating a tag:** if the picker search matches nothing, it offers "Create 'xyz'". Creating it asks for a group: any built-in group, any custom group, or a new group created on the spot.
- **Custom groups:** the owner can create them. A custom group is listed after the built-in groups.
- **Rename and delete:** both apply to the owner's own tags and groups.
  - Renaming a tag changes the name everywhere: every meal and food shows the new name on every device.
  - Deleting a tag removes it from every meal and food.
- **Search:** the owner's tags are searched and filtered exactly like built-in ones. There is one search box across all groups.
- **Duplicate names (my call):**
  - Creating or renaming is refused when the name matches an existing tag ignoring case and diacritics ("kimchi" = "Kimchi"). Instead, the picker offers the existing tag.
  - Group names follow the same rule.
  - Two devices creating the same name offline before syncing is accepted as rare for a single user. Both tags then show, and the owner can delete one.
  - Automatic merging is out of scope.

### 3.4 Storage: meals and foods point to tags
- Meals and foods store tag **ids**, not names, so a rename is a single change to one tag record.
- The owner's tags and groups are synced records.
- Built-in tags are never stored, only referenced by id.

### 3.5 Filtering (Meals tab and Foods tab)
Layout A from the mockups: the existing search box, then rows of chips.

- **Meals tab:**
  - A row with the four meal types, always visible.
  - Below it, the selected ingredient tags (each removable with ✕) and a "＋ Ingredient" chip that opens the grouped tag picker.
  - A result count with "Clear filters".
  - Each meal row shows its tags as a muted line under the name (for example "Lunch · Chicken · Rice").
- **Foods tab:** the same layout without the meal-type row.
- **How selections combine:**
  - Selected meal types combine with **any**: Lunch shows meals tagged Lunch, including those also tagged Dinner.
  - Selected ingredient tags combine with **all**: Chicken + Rice shows only meals that have both.
  - Meal types and ingredient tags combine with each other with **and**.
- The search box text further narrows the tag-filtered list by name.
- **"All" applies to the selected tags only** (owner's decision, framed around "what can I make from my fridge").
  - A meal matches when it has every selected ingredient tag. It may have any number of other tags.
  - So Chicken + Rice matches a meal tagged Chicken, Rice, Oil and Garlic. No second filter mode is wanted.
- **"Untagged" chip (my call):**
  - For meals it means no ingredient tags; meal types don't count. For foods it means no tags.
  - It works on its own: selecting it clears the other chips, and selecting another chip clears it.

### 3.6 Meal editor
As in the agreed mockup. The fields, in order:

1. Name
2. Meal type chips (multi-select)
3. Ingredient tag chips with "＋ Tag"
4. Ingredients
5. Servings

The rules:
- **Choose rows:** every ingredient tag that no current ingredient carries shows a "Choose {tag} ＋" row in the ingredients list. Removing the tag removes the row.
- **The Choose screen:** tapping a row opens a list of foods with that tag:
  - first the owner's saved foods with the tag, most used first;
  - then bundled basic foods with the tag that are not yet saved;
  - then a "Search all foods instead" fallback.

  Picking a food goes to the amount screen and back to the meal, where the food replaces the row.
- **Automatic tags:** adding any ingredient adds that food's tags to the meal. A newly added tag is briefly highlighted, with **no explanatory text**. It can be removed like any other tag.
- **Unfilled rows don't block saving.** A meal can be saved with an unfilled "Choose" row.
- **Editing:** tags are editable when editing a meal, in the same form.

### 3.6.1 A meal's ingredient tags follow its ingredients (owner's decision)
A meal's ingredient tags are not a copy made when it is saved. They are always computed from three sets:

```
meal tags = (tags of all current ingredient foods  ∪  tags added by hand)  −  tags removed by hand
```

- The meal stores only the hand-made parts: **added tag ids** (which includes the tags behind "Choose" rows) and **removed tag ids**.
- **Tagging a food reaches its meals.** Tagging or re-tagging a food later (for example tagging an old "Rýže basmati" as Rice from the Untagged filter) changes every meal that uses it, with no meal edits.
- **Removing a tag in the form:**
  - A tag that comes from an ingredient goes into "removed", so it stays off even though the ingredient still carries it.
  - A tag that was only added by hand leaves "added".
  - Adding a tag again clears it from "removed".
- **Removing or swapping an ingredient:**
  - Tags that only that ingredient brought disappear.
  - A tag that was also added by hand stays, and its "Choose {tag}" row comes back.
- **Choose rows:** they are shown for every meal tag that no current ingredient carries.
- **The diary is unaffected:** diary entries keep their snapshots.
- The computation is a pure, unit-tested domain function. Filters, meal rows and the Choose rows all use it.

### 3.7 Food tagging
- **The food form** (create and edit, `FoodForm.tsx`) gets an ingredient tag row with "＋ Tag".
- **First log of an Open Food Facts product:** the amount screen also shows its tag row before "Add to diary", so the owner confirms tags right then.
  - The row is pre-filled with a guess from the product's Open Food Facts categories.
  - Products already among saved foods are not asked again.
- **Where it appears (my call):**
  - The prompt shows wherever an Open Food Facts product is saved for the first time: logging it to the diary, and adding it as a meal ingredient (the same amount screen).
  - `usda` is not used by the app today and is out of scope.
- **Category data (my call):** the guess needs categories, so add the product's category tags (`categories_tags`) to the fields requested, for both barcode lookup and search.
- **"Untagged" chip:** both tabs get one so the owner can tag existing meals and foods by hand.

### 3.8 Logging from the diary
"Add" under a slot shows meals tagged with that slot first, then the owner's other meals.

My call, so the most-used screen doesn't bury recent foods:
- **With an empty search:** all meals tagged with that slot are shown, then other meals up to the current five in total, then the existing recent foods.
- **Once something is typed:** every matching meal is shown, with the slot's meals first.

## 4. Constraints from the existing app

- **Local-first.** Everything works offline. All screens read only from Dexie.
- **Sync.**
  - Every synced row has `id`, `updatedAt`, `deletedAt` and `dirty` (`docs/DESIGN.md` §4.1).
  - New synced tables must be registered in `entityTables` (`src/sync/engine.ts`).
  - The server stores generic records, so no Supabase change is needed.
  - Pull already skips unknown entities from newer app versions.
- **Dexie.** The schema is at version 2 (`src/db/schema.ts`). New tables and fields need a version 3.
  - Existing meals and foods have no tag fields. Treat a missing field as "no tags".
- **Content Security Policy.** Network access is limited to the app, Supabase and `world.openfoodfacts.org` (`public/_headers`). Category data must come from the existing Open Food Facts API.
- **Diary entries are snapshots.** Tags do not touch them.
- **Domain logic stays pure and unit-tested** (`src/domain/`), as the rest of the app does. This covers filter combination, guessing tags from categories, and which "Choose" rows to show.
- **The UI follows the existing look:** yellow on black, the existing `components/ui.tsx` building blocks, phone-first.

## 5. Left to the builder

- **Data model specifics.** Table and field names (for example `tagIds` on `Food`; `slots`, `addedTagIds` and `removedTagIds` on `Meal`, per §3.6.1) and indexing.
  - A multi-entry index is optional; filtering in memory is fine at this scale.
- **Rename and delete mechanics:**
  - A rename only updates the tag record.
  - A delete soft-deletes the tag. Meals and foods then ignore unknown or deleted tag ids, with optional cleanup of the stale ids.
  - When a custom group is deleted, its tags must not be lost; for example, ask where to move them, or move them to "Extras".
- **Where tags and groups are managed.** For example, a "Tags" screen under More, and/or editing from inside the picker.
- **The category-to-tag mapping** for Open Food Facts (for example `en:rices` → Rice, `en:chicken-breasts` → Chicken), and which product fields to request.
- **Exact tag ids for bundled foods** and their spellings.
- **Visual details of the tag picker sheet** (grouped list with one search box).
- **Tests:** following the existing Vitest setup. This includes a sync test that a tag rename on one device reaches another and is not reverted by an edit to a meal there.

## 6. Mockups

Saved under `.superpowers/brainstorm/` (not committed): `meals-filter.html` (option A chosen) and `meal-editor.html` (accepted, minus the explanatory note).
