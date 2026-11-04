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

test('edits a logged meal portion and optionally updates the saved meal', async ({ page }) => {
  const chickenName = 'Kuřecí prsa bez kůže, syrová'
  const amount = (root: ReturnType<typeof sheet>) => root.getByLabel(`Amount of ${chickenName}`)

  await tab(page, 'Meals')
  await page.getByRole('button', { name: 'New meal' }).click()
  const editor = sheet(page, 'New meal')
  await editor.getByLabel('Name', { exact: true }).fill('Rýže s kuřetem')
  await editor.getByRole('button', { name: '+ Add ingredient' }).click()
  await pickFood(page, 'kureci prsa', chickenName)
  await page.getByLabel(/Amount \(g\)/).fill('200')
  await page.getByRole('button', { name: 'Add to meal' }).click()
  await editor.getByLabel('Servings this recipe makes').fill('2')
  await editor.getByRole('button', { name: 'Done' }).click()
  await expect(editor).toBeHidden()

  /** The saved meal's chicken amount, read in the meal editor (then closed). */
  async function savedChicken() {
    await tab(page, 'Meals')
    await page.getByRole('button', { name: /Rýže s kuřetem/ }).click()
    await sheet(page, 'Rýže s kuřetem').getByRole('button', { name: 'Edit', exact: true }).click()
    const edit = sheet(page, 'Edit meal')
    const value = await amount(edit).inputValue()
    await edit.getByRole('button', { name: 'Close' }).click()
    await sheet(page, 'Rýže s kuřetem').getByRole('button', { name: 'Close' }).click()
    await tab(page, 'Diary')
    return value
  }

  await tab(page, 'Diary')
  await page.getByRole('button', { name: 'Add food' }).click()
  await page.getByPlaceholder(/Search foods/).fill('ryze s kuretem')
  await page.getByRole('button', { name: /Rýže s kuřetem/ }).first().click()
  await page.getByRole('button', { name: 'Add to diary' }).click()
  const entry = page.getByRole('button', { name: /Rýže s kuřetem/ })
  await expect(entry).toContainText('120')

  // Just this entry
  await entry.click()
  const edit = sheet(page, 'Edit entry')
  await expect(edit.getByText('On your plate')).toBeVisible()
  await expect(amount(edit)).toHaveValue('100')
  await amount(edit).fill('150')
  await edit.getByRole('button', { name: 'Done' }).click()
  const dialog = page.getByRole('dialog', { name: 'Also update the saved meal?' })
  await dialog.getByRole('button', { name: 'Just this entry' }).click()
  await expect(edit).toBeHidden()
  await expect(entry).toContainText('180')
  await expect(entry).toContainText('· edited')
  expect(await savedChicken()).toBe('200')

  // An emptied amount is refused
  await entry.click()
  await amount(edit).fill('')
  await edit.getByRole('button', { name: 'Done' }).click()
  await expect(edit.getByRole('alert')).toHaveText('Add at least one ingredient, each with an amount above 0.')

  // Update the saved meal too, and remember it for today
  await amount(edit).fill('160')
  await edit.getByRole('button', { name: 'Done' }).click()
  await dialog.getByLabel("Don't ask again for this meal today").check()
  await dialog.getByRole('button', { name: 'Update saved meal too' }).click()
  await expect(edit).toBeHidden()
  await expect(entry).toContainText('192')
  expect(await savedChicken()).toBe('220')

  // Remembered: no dialog; a decimal comma works
  await entry.click()
  await amount(edit).fill('170,5')
  await edit.getByRole('button', { name: 'Done' }).click()
  await expect(edit).toBeHidden()
  await expect(dialog).toBeHidden()
  await expect(entry).toContainText('205')
  expect(await savedChicken()).toBe('241')
})

test('shows an error when saving a logged meal edit fails', async ({ page }) => {
  await tab(page, 'Meals')
  await page.getByRole('button', { name: 'New meal' }).click()
  const editor = sheet(page, 'New meal')
  await editor.getByLabel('Name', { exact: true }).fill('Zkušební jídlo')
  await editor.getByRole('button', { name: '+ Add ingredient' }).click()
  await pickFood(page, 'kureci prsa', 'Kuřecí prsa bez kůže, syrová')
  await page.getByLabel(/Amount \(g\)/).fill('200')
  await page.getByRole('button', { name: 'Add to meal' }).click()
  await editor.getByRole('button', { name: 'Done' }).click()
  await expect(editor).toBeHidden()

  await tab(page, 'Diary')
  await page.getByRole('button', { name: 'Add food' }).click()
  await page.getByPlaceholder(/Search foods/).fill('zkusebni jidlo')
  await page.getByRole('button', { name: /Zkušební jídlo/ }).first().click()
  await page.getByRole('button', { name: 'Add to diary' }).click()

  await page.getByRole('button', { name: /Zkušební jídlo/ }).click()
  const edit = sheet(page, 'Edit entry')
  await edit.getByLabel('Amount of Kuřecí prsa bez kůže, syrová').fill('250')
  // Every write from now on fails, as on a full or broken database.
  await page.evaluate(() => {
    const fail = () => {
      throw new DOMException('Write blocked for the test', 'QuotaExceededError')
    }
    IDBObjectStore.prototype.put = fail
    IDBObjectStore.prototype.add = fail
    IDBCursor.prototype.update = fail
  })
  await edit.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Just this entry' }).click()
  await expect(edit.getByRole('alert')).toContainText("Couldn't save")
  await expect(edit).toBeVisible()
})
