import { expect, logFood, test } from './helpers'

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
