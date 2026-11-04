import { expect, tab, test } from './helpers'

test('logs a weight and shows it as the latest', async ({ page }) => {
  await tab(page, 'Body')
  await page.getByLabel(/Weight \(kg\)/).fill('80,5')
  await page.getByRole('button', { name: 'Save weight' }).click()

  await expect(page.getByText(/Saved 80[.,]5 kg/)).toBeVisible()
  await expect(page.getByText('Latest').locator('..')).toContainText(/80[.,]5 kg/)
})
