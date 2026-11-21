import type { Page } from '@playwright/test'
import { expect, logFood, pickFood, sheet, tab, test } from './helpers'

const CHICKEN = 'Kuřecí prsa bez kůže, syrová' // 120 kcal per 100 g

test('logs a bundled food from search, with Czech words typed without diacritics', async ({ page }) => {
  await logFood(page, 'kureci prsa', CHICKEN, 150)

  const entry = page.getByRole('button', { name: new RegExp(CHICKEN) })
  await expect(entry).toContainText('150 g')
  await expect(entry).toContainText('180')
})

test('edits an entry amount, then deletes it and undoes the delete', async ({ page }) => {
  await logFood(page, 'kureci prsa', CHICKEN, 100)
  const entry = page.getByRole('button', { name: new RegExp(CHICKEN) })

  await entry.click()
  await page.getByLabel(/Amount \(g\)/).fill('250')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(entry).toContainText('250 g')
  await expect(entry).toContainText('300')

  await entry.click()
  await page.getByRole('button', { name: 'Delete entry' }).click()
  await expect(entry).toBeHidden()
  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(entry).toContainText('250 g')
})

test('adding to a slot lists that slot\'s meals first, then other meals, then recent foods', async ({ page }) => {
  async function createMeal(name: string, mealType?: string) {
    await tab(page, 'Meals')
    await page.getByRole('button', { name: 'New meal' }).click()
    const editor = sheet(page, 'New meal')
    await editor.getByLabel('Name', { exact: true }).fill(name)
    if (mealType) await editor.getByRole('group', { name: 'Meal type' }).getByRole('button', { name: mealType }).click()
    await editor.getByRole('button', { name: '+ Add ingredient' }).click()
    await pickFood(page, 'kureci prsa', CHICKEN)
    await page.getByLabel(/Amount \(g\)/).fill('100')
    await page.getByRole('button', { name: 'Add to meal' }).click()
    await editor.getByRole('button', { name: 'Done' }).click()
    await expect(editor).toBeHidden()
  }
  await createMeal('Večerní salát')
  await createMeal('Polední polévka', 'Lunch')
  await tab(page, 'Diary')
  await logFood(page, 'kureci prsa', CHICKEN, 120)

  const lunch = page.locator('.rounded-xl').filter({ has: page.getByRole('heading', { name: 'Lunch', exact: true }) })
  await lunch.getByRole('button', { name: '+ Add' }).click()

  const sections = page.locator('section')
  await expect(sections.locator('h3')).toHaveText(['For lunch', 'Other meals', 'Recent foods'])
  await expect(page.getByRole('region', { name: 'For lunch' })).toContainText('Polední polévka')
  await expect(page.getByRole('region', { name: 'For lunch' })).not.toContainText('Večerní salát')
  await expect(page.getByRole('region', { name: 'Other meals' })).toContainText('Večerní salát')
  await expect(page.getByRole('region', { name: 'Recent foods' })).toContainText(CHICKEN)
})

const RICE = 'Rýže bílá, vařená' // 130 kcal per 100 g

/** The diary card of a slot, by its heading. */
const slotCard = (page: Page, name: string) =>
  page.locator('.rounded-xl').filter({ has: page.getByRole('heading', { name, exact: true }) })

async function logToSlot(page: Page, slotName: string, query: string, name: string, grams: number) {
  await slotCard(page, slotName).getByRole('button', { name: '+ Add' }).click()
  await pickFood(page, query, name)
  await page.getByLabel(/Amount \(g\)/).fill(String(grams))
  await page.getByRole('button', { name: 'Add to diary' }).click()
  await expect(page.getByRole('heading', { name: 'Amount' })).toBeHidden()
}

test('saves a slot of foods as a meal that replaces them', async ({ page }) => {
  await logToSlot(page, 'Dinner', 'kureci prsa', CHICKEN, 150)
  await logToSlot(page, 'Dinner', 'ryze varena', RICE, 200)
  const dinner = slotCard(page, 'Dinner')
  await expect(dinner).toContainText('440 kcal')

  await dinner.getByRole('button', { name: 'Save as meal' }).click()
  const save = sheet(page, 'Save as meal')
  await expect(save).toContainText(CHICKEN)
  await expect(save).toContainText(RICE)
  await expect(save.getByRole('button', { name: 'Done' })).toBeDisabled()
  await save.getByLabel('Name').fill('Rychlá večeře')
  await save.getByRole('button', { name: 'Done' }).click()
  await expect(save).toBeHidden()

  await expect(page.getByRole('status')).toContainText('Saved as meal Rychlá večeře')
  const entry = dinner.getByRole('button', { name: /Rychlá večeře/ })
  await expect(entry).toContainText('1 × meal')
  await expect(dinner).not.toContainText(CHICKEN)
  await expect(dinner).toContainText('440 kcal')
  await expect(dinner.getByRole('button', { name: 'Save as meal' })).toBeHidden()

  await dinner.getByRole('button', { name: '+ Add' }).click()
  await expect(page.getByRole('region', { name: 'For dinner' })).toContainText('Rychlá večeře')
})

test('saves a single logged food as a meal from Edit entry', async ({ page }) => {
  await logToSlot(page, 'Snacks', 'kureci prsa', CHICKEN, 100)
  const snack = slotCard(page, 'Snacks')
  // One food: the button is in Edit entry, not on the slot.
  await expect(snack.getByRole('button', { name: 'Save as meal' })).toBeHidden()

  await snack.getByRole('button', { name: new RegExp(CHICKEN) }).click()
  const edit = sheet(page, 'Edit entry')
  // Save as meal sits above Delete entry.
  await expect(edit.getByRole('button', { name: /^(Save as meal|Delete entry)$/ })).toHaveText(['Save as meal', 'Delete entry'])
  await edit.getByRole('button', { name: 'Save as meal' }).click()
  const save = sheet(page, 'Save as meal')
  await expect(save.getByLabel('Name')).toHaveValue(CHICKEN)
  await save.getByRole('button', { name: 'Done' }).click()

  await expect(save).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Edit entry' })).toBeHidden()
  await expect(snack.getByRole('button', { name: new RegExp(CHICKEN) })).toContainText('1 × meal')
})

const EGG = 'Vejce slepičí, celé' // 143 kcal per 100 g, 1 serving = 50 g (1 vejce (M))

test('a food logged in servings shows and edits in servings', async ({ page }) => {
  await slotCard(page, 'Breakfast').getByRole('button', { name: '+ Add' }).click()
  await pickFood(page, 'vejce', EGG)
  await page.getByLabel(/^Servings/).fill('2')
  await page.getByRole('button', { name: 'Add to diary' }).click()

  const entry = slotCard(page, 'Breakfast').getByRole('button', { name: new RegExp(EGG) })
  await expect(entry).toContainText('2 servings · 100 g')
  await expect(entry).toContainText('143')

  await entry.click()
  const edit = sheet(page, 'Edit entry')
  await expect(edit.getByLabel(/^Servings/)).toHaveValue('2')
  await edit.getByRole('button', { name: 'More servings' }).click()
  await edit.getByRole('button', { name: 'More servings' }).click()
  await expect(edit).toContainText('200 g in total')
  await edit.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(entry).toContainText('4 servings · 200 g')
  await expect(entry).toContainText('286')

  // Opening and saving without a change keeps it as it is.
  await entry.click()
  await sheet(page, 'Edit entry').getByRole('button', { name: 'Save', exact: true }).click()
  await expect(entry).toContainText('4 servings · 200 g')
  await expect(entry).toContainText('286')
})

test('a food logged in grams can be switched to servings', async ({ page }) => {
  await slotCard(page, 'Breakfast').getByRole('button', { name: '+ Add' }).click()
  await pickFood(page, 'vejce', EGG)
  await page.getByRole('button', { name: 'Grams' }).click()
  await page.getByLabel(/Amount \(g\)/).fill('100')
  await page.getByRole('button', { name: 'Add to diary' }).click()

  const entry = slotCard(page, 'Breakfast').getByRole('button', { name: new RegExp(EGG) })
  await expect(entry).toContainText('100 g')
  await expect(entry).not.toContainText('servings')

  await entry.click()
  const edit = sheet(page, 'Edit entry')
  await expect(edit.getByLabel(/Amount \(g\)/)).toHaveValue('100')
  await edit.getByRole('button', { name: 'Servings' }).click()
  await expect(edit.getByLabel(/^Servings/)).toHaveValue('2')
  await edit.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(entry).toContainText('2 servings · 100 g')
})

const AI_ANSWER = `Assuming a large kebab in a tortilla with chicken, cabbage and garlic sauce, roughly 800–900 kcal.

Name: Kebab v tortille
Weight: 450 g
Energy: 890 kcal
Protein: 48 g
Carbohydrates: 82 g
Sugars: 6 g
Fat: 39 g
Fibre: 5 g
Salt: 4.2 g`

async function readAiAnswerInto(page: Page, answer: string) {
  await slotCard(page, 'Dinner').getByRole('button', { name: '+ Add' }).click()
  await page.getByRole('button', { name: '✨ From AI' }).click()
  await page.getByLabel("The AI's answer").fill(answer)
  await page.getByRole('button', { name: 'Read this answer' }).click()
}

test('logs a one-off from an AI answer', async ({ page }) => {
  await readAiAnswerInto(page, AI_ANSWER)
  const check = sheet(page, 'Check')
  await expect(check.getByLabel('Name')).toHaveValue('Kebab v tortille')
  await expect(check.getByLabel('Amount (g)')).toHaveValue('450')
  await check.getByLabel('Amount (g)').fill('225')
  await expect(check).toContainText('445')
  await check.getByRole('button', { name: 'Add to diary' }).click()

  const dialog = page.getByRole('dialog', { name: 'Save "Kebab v tortille" as a food?' })
  await dialog.getByRole('button', { name: 'Just this entry' }).click()
  const entry = slotCard(page, 'Dinner').getByRole('button', { name: /Kebab v tortille/ })
  await expect(entry).toContainText('✨ AI estimate · 225 g')
  await expect(entry).toContainText('445')

  await tab(page, 'Foods')
  await expect(page.getByText('Kebab v tortille')).toHaveCount(0)
})

test('stores an AI estimate as a food when asked', async ({ page }) => {
  await readAiAnswerInto(page, AI_ANSWER)
  await sheet(page, 'Check').getByRole('button', { name: 'Add to diary' }).click()
  await page.getByRole('dialog', { name: /as a food\?/ }).getByRole('button', { name: 'Save as a food too' }).click()
  await expect(slotCard(page, 'Dinner').getByRole('button', { name: /Kebab v tortille/ })).toContainText('✨ AI estimate · 450 g')
  await tab(page, 'Foods')
  await expect(page.getByText('Kebab v tortille')).toBeVisible()
})

test('says what is missing from an AI answer', async ({ page }) => {
  await readAiAnswerInto(page, AI_ANSWER.replace('Weight: 450 g\n', ''))
  await expect(page.getByRole('alert')).toContainText("Couldn't find Weight in the answer")
})
