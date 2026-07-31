import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('unauthenticated user is redirected from /app to /login', async ({ page }) => {
    await page.goto('/app')
    await expect(page).toHaveURL('/login')
  })

  test('unknown routes redirect to landing', async ({ page }) => {
    await page.goto('/nonexistent')
    await expect(page).toHaveURL('/')
  })
})
