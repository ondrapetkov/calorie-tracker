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
  await page.getByRole('button', { name: 'Save' }).click()
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
