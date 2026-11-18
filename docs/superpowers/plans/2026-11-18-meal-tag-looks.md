# Meal Tag Looks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Time-of-day tags and ingredient tags on the Meals tab look clearly different.

**Architecture:** A `SlotChip` (square badge-style chip) replaces `TagChip` for slots in `TagFilterBar` and `MealEditor`. The meal list row renders two lines: 🕐 + yellow `SlotBadge`s, then grey ingredient names with emoji. `useVocabulary.ts` gains `tagLabels` returning `{ name, icon }`.

**Tech Stack:** React 19, Tailwind, Playwright (Firefox + WebKit).

**Spec:** `docs/superpowers/specs/2026-11-18-meal-tag-looks-design.md`

## Global Constraints

- Badge: solid accent background, `text-on-accent`, bold, uppercase, `text-[10px]`, `rounded`, `px-1.5`.
- Slot chip: `rounded-md` border accent, accent uppercase bold text; selected = filled accent with `text-on-accent`; keeps `aria-pressed`.
- Row lines: `aria-label="Meal type: Lunch, Dinner"` and `aria-label="Ingredients: Chicken, Rice"`; 🕐 `aria-hidden`.

## Review Focus

- A meal with ingredient tags but no time of day shows no empty badge line. (e2e in Task 1.)
- A meal with neither shows neither line. (Covered by existing e2e meals without tags.)
- Slot chips still toggle the filter and the editor's meal types (existing e2e use `getByRole('group', { name: 'Meal type' }).getByRole('button', { name: 'Lunch' })`, which must keep working: the accessible name stays the label, not uppercase-transformed text — use CSS `uppercase`, not uppercase strings).

---

### Task 1: Distinct looks for time-of-day and ingredient tags

**Files:**
- Create: `src/features/tags/SlotChip.tsx` (exports `SlotChip({ label, selected, onClick })` and `SlotBadge({ label })`)
- Modify: `src/features/tags/useVocabulary.ts` (add `tagLabels(vocab, ids): { name: string; icon: string }[]`), `src/features/meals/MealsScreen.tsx`, `src/features/tags/TagFilterBar.tsx`, `src/features/meals/MealEditor.tsx`
- Test: `e2e/foods-and-meals.spec.ts`

- [ ] **Step 1: Write the failing e2e test** `the meal list shows time of day and ingredient tags apart`: create a meal with meal type Lunch and the chicken ingredient (bundled chicken carries the Chicken tag); create a second with chicken and no meal type. On the Meals tab: the first row's `getByLabel('Meal type: Lunch')` is visible and `getByLabel('Ingredients: Chicken')` contains `Chicken`; the second row has `Ingredients: Chicken` and no element labelled `/^Meal type:/`.
- [ ] **Step 2: Run** `npx playwright test e2e/foods-and-meals.spec.ts -g "apart"`, expect FAIL (no such labels).
- [ ] **Step 3: Implement** `SlotChip`/`SlotBadge`, `tagLabels`, the two-line row, and swap `TagChip` → `SlotChip` for slots in `TagFilterBar` and `MealEditor`.
- [ ] **Step 4: Run** `npx playwright test && npx vitest run && npm run build`, expect all pass.
- [ ] **Step 5: Check** an iPhone-size WebKit screenshot of the Meals tab against the approved mockup.
- [ ] **Step 6: Commit** "Make time-of-day and ingredient tags look different on the Meals tab".
