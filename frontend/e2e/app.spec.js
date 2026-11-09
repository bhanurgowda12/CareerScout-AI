import { expect, test } from '@playwright/test';

async function mockBackend(page) {
  await page.route('http://127.0.0.1:8000/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/health') {
      await route.fulfill({ json: { status: 'ok', message: 'test backend' } });
      return;
    }
    await route.fulfill({ status: 503, json: { detail: 'Unavailable in E2E tests.' } });
  });
}

test('application loads and exposes labeled main navigation', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');

  await expect(page).toHaveTitle(/CareerScout AI/);
  await expect(page.getByRole('heading', { level: 1, name: /Your future is/i })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(navigation.getByRole('link', { name: 'Home' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: 'Features' })).toBeVisible();
});

test('sign-in interface renders without contacting Firebase services', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Welcome back.' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.locator('.auth-page').getByRole('button', { name: 'Sign In', exact: true })).toBeVisible();
});

test('lazy-loaded username page renders an accessible loading state and content', async ({ page }) => {
  await page.route('**/src/UsernameSetup.jsx', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  await page.goto('/e2e/fixtures/lazy-page.html');

  await expect(page.getByRole('status').filter({ hasText: 'Loading this page' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Choose your username' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
});

test('lazy page chunk failures show a recoverable error state', async ({ page }) => {
  await page.route('**/src/UsernameSetup.jsx', (route) => route.abort());
  await page.goto('/e2e/fixtures/lazy-page.html');

  await expect(page.getByRole('alert').filter({ hasText: 'This page could not be loaded' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();
});
