# Log a one-off from an AI estimate (1.0 change #7)

## Why

For food without a barcode or a kaloricketabulky.cz page, the owner asks an AI to estimate the nutrition and then
types the numbers into a new custom food. That is slow, and the food is almost always a one-off (store-bought and
chain food is findable elsewhere), so the saved food is clutter. The goal is to save time: no hand-typed JSON, no
retyping numbers.

## Approaches considered

- **A. "From AI" in the add sheet (picked, default).** Copy a prompt from the app, paste the AI's answer back,
  check, add to the diary. No food is saved.
- B. The same, but always save a (hidden) food behind the entry. Clutter and plumbing for one-offs.
- C. The app calls an AI itself. Needs an API key in the app, costs per request, network, one provider.

The owner picked **A as the default, with B as an option**: after adding, a popup asks whether to also store it as
a food. The popup appears only in the From AI flow.

## What gets built

**Add sheet:** a "✨ From AI" button next to "Create custom food" (only when adding to the diary, not when picking an
ingredient for a meal).

**From AI screen** (mockup approved):
1. **Copy prompt** copies the prompt below; the button then reads "✓ Prompt copied".
2. **Paste the answer** reads the clipboard; a text box is the fallback (as in the existing Paste view).

**Check screen:** Name (editable), Amount in g (the AI's weight; editable, values scale with it), the nutrition
preview, the Meal (slot) picker, **Add to diary**. If the answer has no readable block, an error explains what is
missing and the text stays in the box.

**Store-it popup (B as an option):** on Add to diary, a bottom dialog like the "Also update the saved meal?" one:
"Save <name> as a food?" with **Just this entry** (primary, the default) and **Save as a food too**.
- Just this entry: a diary entry with no food behind it.
- Save as a food too: a custom food (values per 100 g worked out from the estimate, serving size = the estimated
  portion, named "1 portion"), and the entry is logged from that food, so it shows in Foods and Recent foods and can
  go into Save as meal.

**Diary row:** `✨ AI estimate · 450 g · P … C … F …`. Edit entry works as for any food entry.

**The prompt:**

```
Estimate the nutrition of the food I described, for the whole portion I ate. If something is unclear, make a sensible assumption and say it in one sentence instead of asking me.

End your answer with exactly this block, filled in. Single numbers only, no ranges, no extra text inside the block:

Name: [short name of the dish]
Weight: [g] g
Energy: [kcal] kcal
Protein: [g] g
Carbohydrates: [g] g
Sugars: [g] g
Fat: [g] g
Fibre: [g] g
Salt: [g] g
```

**Reading the answer:** only the block starting at the last `Name:` line is read (an AI often mentions kcal earlier
in its prose). Energy, protein, carbohydrates and fat are required; sugars, fibre and salt are optional (unknown when
missing). Weight is required; values are totals for that weight. Reuses the existing label reader for the nutrient
lines (decimal commas, "g"/"mg", kJ fallback).

## Data

- Log entries gain an optional `estimate?: 'ai'`, for the ✨ marker.
- A "just this entry" log entry has `foodId: null` and `mealId: null`; DESIGN.md's "exactly one is set" becomes
  "at most one". Everything that reads entries already works from the entry's own snapshot (edit, totals, stats).
  Save as meal skips such entries (it needs a food), which suits one-offs.
- Rows sync as JSON, so no server change.

## Calls I made (correct me)

- The popup has no "don't ask again": the owner uses this rarely and wants the question each time.
- "Save as a food too" keeps the ✨ marker on the entry, since the values are still an AI estimate.
- The prompt is in English; the AI may answer in any language, and the label reader also knows Czech and Slovak
  words, but the block's labels are fixed English words for reliability.
