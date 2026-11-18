# Tell time-of-day tags from ingredient tags (1.0 change #6)

## Why

On the Meals tab a meal's time-of-day tags and ingredient tags read as one yellow line ("Lunch · Dinner · Chicken ·
Rice"), so you can't tell at a glance which is which. They should look different.

## Approaches considered (mockups in the browser)

- A. Time of day as small solid yellow badges, ingredients in grey with emoji, on one line.
- B. Two lines: time of day in yellow with a 🕐, ingredients on a grey line below with emoji.
- C. Time of day as yellow text, ingredients as grey outlined pills.

The owner picked **B's layout and emoji with A's badges**, keeping the 🕐.

## What gets built

- **Meal list row (Meals tab):** under the name,
  - line 1 (only when the meal has a time of day): 🕐 then one solid yellow badge per time of day (uppercase,
    small, square-ish corners), e.g. `🕐 LUNCH DINNER`;
  - line 2 (only when it has ingredient tags): the ingredient tags in grey, each with its emoji, joined by " · ",
    e.g. `🍗 Chicken · 🍚 Rice`;
  - then the ingredient count / servings line as now.
- **Filter chips (Meals tab):** time-of-day chips become square-cornered yellow badge-style chips (yellow outline and
  text, filled yellow when selected); ingredient chips stay round as now. Approved from the mockup.

## Calls I made (correct me)

- The meal editor's "Meal type" chips get the same square badge style as the filter chips, so time of day looks the
  same everywhere.
- For screen readers the 🕐 is hidden and the lines read "Meal type: Lunch, Dinner" and "Ingredients: Chicken, Rice".
- Long ingredient lines are cut with "…" as today.
