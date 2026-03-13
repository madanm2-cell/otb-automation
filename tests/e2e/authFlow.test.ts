import { test, expect } from '@playwright/test';

test.describe('Auth Flow E2E', () => {
  test('unauthenticated user redirected to login', async ({ page }) => {
    await page.goto('/cycles');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login with valid credentials → dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="Email"]', 'admin@bewakoof.com');
    await page.fill('input[placeholder="Password"]', 'AdminPassword123!');
    await page.click('button:has-text("Sign In")');
    await expect(page).toHaveURL('/');
  });

  test('GD sees only assigned brand in cycles list', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="Email"]', 'gd-bewakoof@bewakoof.com');
    await page.fill('input[placeholder="Password"]', 'GDPassword123!');
    await page.click('button:has-text("Sign In")');

    await page.goto('/cycles');
    // Should see only Bewakoof cycles
    await expect(page.locator('text=Bewakoof')).toBeVisible();
  });

  test('GD cannot navigate to admin pages', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="Email"]', 'gd-bewakoof@bewakoof.com');
    await page.fill('input[placeholder="Password"]', 'GDPassword123!');
    await page.click('button:has-text("Sign In")');

    await page.goto('/admin/users');
    await expect(page.locator('text=Access Denied')).toBeVisible();
  });

  test('admin can access user management', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="Email"]', 'admin@bewakoof.com');
    await page.fill('input[placeholder="Password"]', 'AdminPassword123!');
    await page.click('button:has-text("Sign In")');

    await page.goto('/admin/users');
    await expect(page.locator('text=User Management')).toBeVisible();
  });

  test('sign out → redirected to login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="Email"]', 'admin@bewakoof.com');
    await page.fill('input[placeholder="Password"]', 'AdminPassword123!');
    await page.click('button:has-text("Sign In")');

    await page.click('text=Sign Out');
    await expect(page).toHaveURL(/\/login/);
  });
});
