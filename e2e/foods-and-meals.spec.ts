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

test('the ingredient tag picker has Done in its header', async ({ page }) => {
  await tab(page, 'Meals')
  await page.getByRole('button', { name: 'New meal' }).click()
  await sheet(page, 'New meal').getByRole('button', { name: '＋ Tag' }).click()
  const picker = sheet(page, 'Ingredient tags')
  await picker.getByRole('button', { name: /Chicken/ }).first().click()
  await expect(picker.getByRole('button', { name: 'Done' })).toHaveCount(1)
  await picker.locator('header').getByRole('button', { name: 'Done' }).click()
  // The meal editor has an "Ingredient tags" section heading too; the picker's title is the h2.
  await expect(page.getByRole('heading', { name: 'Ingredient tags', level: 2 })).toBeHidden()
  await expect(sheet(page, 'New meal').getByRole('button', { name: /Chicken/ })).toBeVisible()
})

test('meal ingredients added in servings stay in servings', async ({ page }) => {
  const egg = 'Vejce slepičí, celé' // 143 kcal per 100 g, 1 serving = 50 g
  const amount = (root: ReturnType<typeof sheet>) => root.getByLabel(`Amount of ${egg}`)

  await tab(page, 'Meals')
  await page.getByRole('button', { name: 'New meal' }).click()
  const editor = sheet(page, 'New meal')
  await editor.getByLabel('Name', { exact: true }).fill('Vajíčka')
  await editor.getByRole('button', { name: '+ Add ingredient' }).click()
  await pickFood(page, 'vejce', egg)
  await page.getByLabel(/^Servings \(1 =/).fill('2')
  await page.getByRole('button', { name: 'Add to meal' }).click()

  await expect(amount(editor)).toHaveValue('2')
  await expect(editor).toContainText('100 g')
  await expect(editor.getByRole('button', { name: `Switch ${egg} to grams` })).toHaveText('serv.')
  await editor.getByRole('button', { name: `More ${egg}` }).click()
  await expect(amount(editor)).toHaveValue('3')
  await expect(editor).toContainText('150 g')
  await editor.getByRole('button', { name: 'Done' }).click()
  await expect(editor).toBeHidden()

  // Reopened in the editor, still in servings.
  await page.getByRole('button', { name: /Vajíčka/ }).click()
  await sheet(page, 'Vajíčka').getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(amount(sheet(page, 'Edit meal'))).toHaveValue('3')
  await sheet(page, 'Edit meal').getByRole('button', { name: 'Close' }).click()
  await sheet(page, 'Vajíčka').getByRole('button', { name: 'Close' }).click()

  await tab(page, 'Diary')
  await page.getByRole('button', { name: 'Add food' }).click()
  await page.getByPlaceholder(/Search foods/).fill('vajicka')
  await page.getByRole('button', { name: /Vajíčka/ }).first().click()
  await page.getByRole('button', { name: 'Add to diary' }).click()
  const entry = page.getByRole('button', { name: /Vajíčka/ })
  await expect(entry).toContainText('215')

  // On the plate: in servings, and switching to grams keeps the amount.
  await entry.click()
  const edit = sheet(page, 'Edit entry')
  await expect(amount(edit)).toHaveValue('3')
  await edit.getByRole('button', { name: `Switch ${egg} to grams` }).click()
  await expect(amount(edit)).toHaveValue('150')
  await expect(edit.getByRole('button', { name: `Switch ${egg} to servings` })).toHaveText('g')
  await edit.getByRole('button', { name: 'Done' }).click()
  await page.getByRole('dialog', { name: 'Also update the saved meal?' }).getByRole('button', { name: 'Just this entry' }).click()
  await expect(edit).toBeHidden()
  await expect(entry).toContainText('215')

  await entry.click()
  await expect(amount(edit)).toHaveValue('150')
})

test('switching an ingredient between grams and servings keeps the amount', async ({ page }) => {
  const white = 'Vaječný bílek' // 1 serving = 33 g
  await tab(page, 'Meals')
  await page.getByRole('button', { name: 'New meal' }).click()
  const editor = sheet(page, 'New meal')
  await editor.getByRole('button', { name: '+ Add ingredient' }).click()
  await pickFood(page, 'bilek', white)
  await page.getByRole('button', { name: 'Grams' }).click()
  await page.getByLabel(/Amount \(g\)/).fill('90')
  await page.getByRole('button', { name: 'Add to meal' }).click()

  const amount = editor.getByLabel(`Amount of ${white}`)
  await expect(amount).toHaveValue('90')
  await editor.getByRole('button', { name: `Switch ${white} to servings` }).click()
  await expect(amount).toHaveValue('2.73')
  await editor.getByRole('button', { name: `Switch ${white} to grams` }).click()
  await expect(amount).toHaveValue('90')
})

test('the meal list shows time of day and ingredient tags apart', async ({ page }) => {
  const chicken = 'Kuřecí prsa bez kůže, syrová' // tagged Chicken
  async function createMeal(name: string, mealType?: string | string[]) {
    await tab(page, 'Meals')
    await page.getByRole('button', { name: 'New meal' }).click()
    const editor = sheet(page, 'New meal')
    await editor.getByLabel('Name', { exact: true }).fill(name)
    for (const t of [mealType ?? []].flat())
      await editor.getByRole('group', { name: 'Meal type' }).getByRole('button', { name: t }).click()
    await editor.getByRole('button', { name: '+ Add ingredient' }).click()
    await pickFood(page, 'kureci prsa', chicken)
    await page.getByLabel(/Amount \(g\)/).fill('100')
    await page.getByRole('button', { name: 'Add to meal' }).click()
    await editor.getByRole('button', { name: 'Done' }).click()
    await expect(editor).toBeHidden()
  }
  await createMeal('Kuře k obědu', 'Lunch')
  await createMeal('Kuře kdykoli')
  await createMeal('Kuře večer i v poledne', ['Dinner', 'Lunch'])

  const row = (name: string) => page.getByRole('button', { name: new RegExp(name) })
  await expect(row('Kuře k obědu').getByLabel('Meal type: Lunch')).toBeVisible()
  await expect(row('Kuře k obědu').getByLabel('Ingredients: Chicken')).toContainText('Chicken')
  await expect(row('Kuře kdykoli').getByLabel('Ingredients: Chicken')).toBeVisible()
  await expect(row('Kuře kdykoli').getByLabel(/^Meal type:/)).toHaveCount(0)
  // Badges in day order, whatever order the meal types were ticked in.
  await expect(row('Kuře večer i v poledne').getByLabel('Meal type: Lunch, Dinner')).toBeVisible()
})
