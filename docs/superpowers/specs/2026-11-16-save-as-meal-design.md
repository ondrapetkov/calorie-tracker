# Save logged foods as a meal (1.0 change #4)

## Why

Things eaten on their own (a chocolate bar) and dinners thrown together from whatever is on hand get logged as
separate foods. Next time they have to be searched for again, and they never show up under "For <slot>" in the add
sheet, because only meals are tagged with slots. To the owner, a "Meal" is anything eaten by itself, so these should
be easy to turn into one straight from the Diary tab.

## What gets built

Two entry points, one shared **Save as meal** sheet:

- **One food:** a "Save as meal" button in the Edit entry sheet for a logged food.
- **A whole slot:** a "Save as meal" button at the bottom of a slot's card on the Diary tab. Shown only when the slot
  holds two or more entries and all of them are foods (no meals). A slot with a single food uses the Edit entry
  button, so there are never two buttons for the same thing.

The sheet: Close top left, yellow Done top right (same as the other sheets), a name field (pre-filled with the food's
label for one food, empty for a slot; Done disabled while empty), and the list of ingredients with their logged
amounts and the total kcal, read-only.

On Done, in one transaction:

1. Create a saved meal: the name, **servings 1**, slot tag = the slot the foods were in, one ingredient per food entry
   at its logged amount, in logged order.
2. **Replace** the food entries in the diary with one meal entry ("1 × meal") in the same slot and day, whose plate
   holds those rows. The plate's per-100 values come from the entries' own snapshots, so the day's totals don't
   change. The plate rows link to the new meal's items, so plate editing (change #2) works on it.
3. Toast: "Saved as meal <name>".

## Approaches considered

- **A. Button in Edit entry (picked).** Explicit and keeps the diary uncluttered.
- B. Icon on every food row: one tap, but clutter on every row.
- C. No new meal, just list recent slot foods under "For <slot>": automatic, but the owner wants these to be real
  meals.

The slot-level button was added by the owner as a closely tied extension. Replacing the foods (rather than leaving
them) was the owner's choice.

## Calls I made (correct me)

- No undo on the toast: undoing would mean deleting the meal and restoring the foods. The meal can be deleted from
  the Meals tab, and the meal entry from the diary.
- If any of the foods has been deleted since it was logged, the button is hidden (a meal can't reference a food
  that's gone).
- Meal names don't have to be unique, same as today.
- Not a goal: saving a mix of foods and meals, or picking just some foods out of a slot.
