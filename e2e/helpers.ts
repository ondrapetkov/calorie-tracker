import { test as base, expect, type Page } from '@playwright/test'

/**
 * Every test starts on the Diary with empty local data. Open Food Facts is blocked, so
 * search results come only from saved and bundled foods and the tests don't depend on the network.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(/openfoodfacts\.org/, (route) => route.abort())
    await page.goto('/')
    await expect(page.getByRole('button', { name: 'Diary' })).toBeVisible()
    await use(page)
  },
})

export { expect }

export const tab = (page: Page, name: 'Diary' | 'Meals' | 'Foods' | 'Body' | 'More') =>
  page.getByRole('navigation').getByRole('button', { name }).click()

/** The full-screen sheet on top, by its header title. */
export const sheet = (page: Page, title: string) =>
  page.locator('div.fixed.inset-0').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).last()

/** In the open Add food sheet: search for a food and open its amount step. */
export async function pickFood(page: Page, query: string, name: string) {
  await page.getByPlaceholder(/Search foods/).fill(query)
  await page.getByRole('button', { name: new RegExp(name) }).first().click()
  await expect(page.getByRole('heading', { name: 'Amount' })).toBeVisible()
}

/** From the Diary: log a bundled food by weight. */
export async function logFood(page: Page, query: string, name: string, grams: number) {
  await page.getByRole('button', { name: 'Add food' }).click()
  await pickFood(page, query, name)
  await page.getByLabel(/Amount \(g\)/).fill(String(grams))
  await page.getByRole('button', { name: 'Add to diary' }).click()
  await expect(page.getByRole('heading', { name: 'Amount' })).toBeHidden()
}
