import { test, expect } from '@playwright/test'

test.describe('Landing page', () => {
  test('displays title and tagline', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'The Art of Art' })).toBeVisible()
    await expect(page.getByText('Your guide to the scene')).toBeVisible()
  })

  test('Get Started link navigates to signup', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Get Started' }).click()
    await expect(page).toHaveURL('/signup')
  })

  test('Sign In link navigates to login', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Sign In' }).click()
    await expect(page).toHaveURL('/login')
  })

  test('displays version number', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/v\d+\.\d+\.\d+/)).toBeVisible()
  })
})
