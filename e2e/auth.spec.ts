import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test('has email and password fields', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByPlaceholder('Email')).toBeVisible()
    await expect(page.getByPlaceholder('Password')).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('Email').fill('bad@test.com')
    await page.getByPlaceholder('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign In' }).click()
    await expect(page.getByText(/invalid/i)).toBeVisible({ timeout: 10000 })
  })

  test('has link to signup page', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: 'Sign up' }).click()
    await expect(page).toHaveURL('/signup')
  })

  test('has back link to landing', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('link', { name: /back/i }).click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('Signup page', () => {
  test('has email and password fields', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByPlaceholder('Email')).toBeVisible()
    await expect(page.getByPlaceholder(/password/i)).toBeVisible()
  })

  test('prevents submission with short password', async ({ page }) => {
    await page.goto('/signup')
    await page.getByPlaceholder('Email').fill('test@test.com')
    await page.getByPlaceholder(/password/i).fill('short')
    await page.getByRole('button', { name: 'Get Started' }).click()
    // Native minLength validation prevents form submission
    await expect(page).toHaveURL('/signup')
  })

  test('has link to login page', async ({ page }) => {
    await page.goto('/signup')
    await page.getByRole('link', { name: 'Sign in' }).click()
    await expect(page).toHaveURL('/login')
  })

  test('has back link to landing', async ({ page }) => {
    await page.goto('/signup')
    await page.getByRole('link', { name: /back/i }).click()
    await expect(page).toHaveURL('/')
  })
})
