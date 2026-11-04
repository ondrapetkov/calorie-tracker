import { expect, pickFood, sheet, tab, test } from './helpers'

test('creates a custom food with the header Done, after an empty-form error', async ({ page }) => {
  await tab(page, 'Foods')
  await page.getByRole('button', { name: 'New', exact: true }).click()
  const form = sheet(page, 'New food')

  await form.getByRole('button', { name: 'Done' }).click()
  await expect(form.getByRole('alert')).toHaveText('Enter a name.')

  await form.getByLabel('Name', { exact: true }).fill('Test granola')
  await form.getByLabel('Energy (kcal)').fill('450')
  await form.getByLabel('Protein (g)').fill('10')
  await form.getByLabel('Carbs (g)').fill('60')
  await form.getByLabel('Fat (g)').fill('18')
  await form.getByRole('button', { name: 'Done' }).click()

  await expect(form).toBeHidden()
  await expect(page.getByRole('button', { name: /Test granola/ })).toBeVisible()
})

test('builds a meal from an ingredient and logs a serving of it', async ({ page }) => {
  await tab(page, 'Meals')
  await page.getByRole('button', { name: 'New meal' }).click()
  const editor = sheet(page, 'New meal')
  await editor.getByLabel('Name', { exact: true }).fill('Rýže s kuřetem')

  await editor.getByRole('button', { name: '+ Add ingredient' }).click()
  await pickFood(page, 'kureci prsa', 'Kuřecí prsa bez kůže, syrová')
  await page.getByLabel(/Amount \(g\)/).fill('200')
  await page.getByRole('button', { name: 'Add to meal' }).click()
  await expect(editor.getByText('Kuřecí prsa bez kůže, syrová')).toBeVisible()

  await editor.getByRole('button', { name: 'Done' }).click()
  await expect(editor).toBeHidden()
  await expect(page.getByRole('button', { name: /Rýže s kuřetem/ })).toBeVisible()

  await tab(page, 'Diary')
  await page.getByRole('button', { name: 'Add food' }).click()
  await page.getByPlaceholder(/Search foods/).fill('ryze s kuretem')
  await page.getByRole('button', { name: /Rýže s kuřetem/ }).first().click()
  await page.getByRole('button', { name: 'Add to diary' }).click()

  const entry = page.getByRole('button', { name: /Rýže s kuřetem/ })
  await expect(entry).toContainText('1 × meal')
  await expect(entry).toContainText('240')
})
