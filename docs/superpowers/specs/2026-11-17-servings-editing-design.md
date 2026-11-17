# Edit amounts in servings (1.0 change #5)

## Why

Foods with a serving size (a slice of bread, an egg) are often logged by the serving, but afterwards the app shows and
edits only grams. Example: 4 slices of bread are logged for dinner; later 2 more are eaten. The diary shows "100 g", so
the owner has to look up the slice weight and do the maths. Anything entered in servings should stay in servings: shown
that way and editable that way, in the diary and inside meals.

## Approaches considered

- **A. Remember how the amount was entered (picked).** An amount entered in servings stores the serving it was entered
  with. It is shown and edited in servings from then on. Amounts entered in grams stay as they are today.
  Trade-off: entries logged before this change only know grams.
- B. Guess from the food: show servings whenever the food has a serving size. Nothing to store and works on old
  entries, but wrong for weighed foods (130 g of chicken with a 150 g portion reads "0.87 portions").

The owner picked A, and asked for it in the diary and in meal ingredients alike.

## What gets built

**Data.** A new optional field on food log entries, on the rows of a logged meal's plate, and on saved-meal
ingredients:

`serving?: { grams: number; label: string | null }`, the size of one serving (g or ml) and its name, as they were
when the amount was entered. The number of servings is always `grams / serving.grams`, so nothing can drift apart
and scaling a recipe scales the servings too. A snapshot, so editing the food's serving size later doesn't change
past entries. Rows are synced as JSON, so no server change is needed. Missing means "entered in grams".

**Where an amount is entered:** in the existing Servings / Amount switch, Servings stores `serving`, Amount
stores none. This applies to logging a food, adding an ingredient to a meal, and adding one to a logged meal's plate.

**Diary row:** a food entered in servings reads `4 servings · 100 g · P … C … F …` instead of `100 g · …`.

**Edit entry (a logged food):** opens in servings, showing 4, when the entry has `serving`. The Servings / Amount
switch is also offered when the entry was logged in grams but its food (still) has a serving size. Saving in servings
stores `serving`; saving in grams removes it.

**Ingredient rows** (a logged meal's plate, and the meal editor): a row with `serving` shows the count in its box,
with "serv." next to it instead of g/ml, and the grams in the small line under the name (`200 kcal · 100 g`). Tapping
the unit (`serv.` / `g`) switches the row between servings and grams, when a serving size is known (the row's own, or
else its food's). The switch converts the number, so the amount doesn't change.

**Carried along:**
- Logging a saved meal: plate rows take the ingredient's `serving` (4 slices in a 2-serving recipe, logged as 1
  serving, is 2 slices).
- Carrying plate edits over to the saved meal (change #2): an ingredient takes the row's `serving`.
- Save as meal (change #4): plate rows and new ingredients take each entry's `serving`.

**+/− buttons (added by the owner):** wherever an amount is in servings, − and + on either side of the box change it
by 1 serving. In the Servings / Amount form (Edit entry and the add flow's Amount step) they flank the full-width box.
In ingredient rows they appear only on rows in servings, whose box is narrowed (counts are short) to make room;
rows in grams are unchanged. − stops at 1 (lower amounts are typed). No buttons in grams mode, where the form already
has the 50 / 100 / 150 / 200 quick buttons.

## Calls I made (correct me)

- The word is "servings" (and "serv." in the narrow rows) rather than the serving's own name. Labels come from many
  sources ("1 vejce (M)", "30 g", "1 slice (20 g)") and don't read well as a unit. The Servings box keeps its
  `1 = <label>` hint.
- Servings are shown with up to 2 decimals (1.5 servings).
- Not a goal: changing a food's serving size from these screens.
