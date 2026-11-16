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

test('cursor trail follows mouse input without blocking controls and respects motion and touch settings', async ({
  page,
  browser,
  baseURL,
}) => {
  await mockBackend(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const cursorEffect = page.locator('.cursor-effect');
  await expect(cursorEffect).toBeVisible();
  await expect(cursorEffect).toHaveAttribute('aria-hidden', 'true');
  await expect(cursorEffect).toHaveCSS('pointer-events', 'none');

  async function getTrailColor(x, y) {
    return cursorEffect.evaluate((canvas, point) => {
      const context = canvas.getContext('2d');
      const scaleX = canvas.width / canvas.clientWidth;
      const scaleY = canvas.height / canvas.clientHeight;
      const pixels = context.getImageData(
        Math.max(0, Math.round((point.x - 24) * scaleX)),
        Math.max(0, Math.round((point.y - 24) * scaleY)),
        Math.round(48 * scaleX),
        Math.round(48 * scaleY),
      ).data;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 24) return [pixels[index], pixels[index + 1], pixels[index + 2]];
      }
      return null;
    }, { x, y });
  }

  async function waitForTrailColor(x, y) {
    let color = null;
    await expect.poll(async () => {
      color = await getTrailColor(x, y);
      return color;
    }).not.toBeNull();
    return color;
  }

  await page.mouse.move(420, 300);
  const lightTrailColor = await waitForTrailColor(420, 300);

  await page.locator('html').evaluate((element) => { element.dataset.theme = 'dark'; });
  await page.mouse.move(500, 300, { steps: 5 });
  const darkTrailColor = await waitForTrailColor(500, 300);
  expect(darkTrailColor).not.toEqual(lightTrailColor);

  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('cursor-test@example.test');
  await page.getByLabel('Password').fill('CursorTestPass9');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(cursorEffect).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(cursorEffect).toBeVisible();

  const touchContext = await browser.newContext({
    isMobile: true,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  const touchPage = await touchContext.newPage();
  await mockBackend(touchPage);
  await touchPage.goto(baseURL, { waitUntil: 'domcontentloaded' });
  await expect(touchPage.locator('.cursor-effect')).toBeHidden();
  await touchContext.close();
});

test('sign-in interface renders without contacting Firebase services', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
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
