import axe from 'axe-core';
import { expect, test } from '@playwright/test';
import {
  createVerifiedAccount,
  installNetworkBoundary,
  openWorkspacePage,
  signInThroughApp,
} from './support.js';

async function mockBackend(page, { onJobSearch } = {}) {
  await installNetworkBoundary(page);
  await page.route('http://127.0.0.1:8000/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/health') {
      await route.fulfill({ json: { status: 'ok' } });
      return;
    }
    if (url.pathname === '/api/job-discovery') {
      onJobSearch?.();
      await route.fulfill({
        json: {
          jobs: [],
          source: 'Remotive',
          sources: ['Remotive'],
          providerErrors: [],
          providerStatus: [],
          fetchedAt: '2026-01-15T12:00:00Z',
          cached: false,
        },
      });
      return;
    }
    if (url.pathname === '/api/learning-resources') {
      await route.fulfill({ json: { videos: [], nextPageToken: null } });
      return;
    }
    await route.fulfill({ status: 503, json: { detail: 'Not configured in accessibility tests.' } });
  });
}

async function getAxeViolations(page, label) {
  const motionStyles = await page.addStyleTag({
    content: `
      *,
      *::before,
      *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
      }
    `,
  });
  let results;
  try {
    await page.addScriptTag({ content: axe.source });
    results = await page.evaluate(async () => window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
      },
    }));
  } finally {
    await motionStyles.evaluate((element) => element.remove());
  }
  const details = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    nodes: violation.nodes.map((node) => ({
      target: node.target,
      summary: node.failureSummary,
      html: node.html,
    })),
  }));
  return details.map((violation) => ({ page: label, ...violation }));
}

function expectNoAxeViolations(violations) {
  expect(violations, 'axe accessibility violations').toEqual([]);
}

test('axe checks the public landing and sign-in pages', async ({ page }) => {
  await mockBackend(page);
  const violations = [];
  await page.goto('/');
  violations.push(...await getAxeViolations(page, 'landing page'));

  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  violations.push(...await getAxeViolations(page, 'sign-in page'));
  expectNoAxeViolations(violations);
});

test('keyboard navigation exposes focus and moves focus to the new SPA page heading', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/');
  await page.keyboard.press('Tab');
  const homeLink = page.locator('header').getByRole('link', { name: 'CareerScout AI' });
  await expect(homeLink).toBeFocused();
  const outline = await homeLink.evaluate((element) => (
    getComputedStyle(element).outlineStyle
  ));
  expect(outline).not.toBe('none');

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Sign In', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  const signInHeading = page.getByRole('heading', { name: 'Welcome back.' });
  await expect(signInHeading).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(page.getByRole('textbox', { name: 'Email address' })).toBeFocused();
  await expect(page.getByLabel('Password')).toHaveAccessibleName('Password');
});

test('screen-reader status and alert regions announce controlled loading and API errors', async ({ page }) => {
  let releaseResponse;
  let markSearchStarted;
  const waitingForSearch = new Promise((resolve) => { markSearchStarted = resolve; });
  const pendingResponse = new Promise((resolve) => { releaseResponse = resolve; });
  await mockBackend(page, {
    onJobSearch: markSearchStarted,
  });
  await page.route('http://127.0.0.1:8000/api/job-discovery', async (route) => {
    markSearchStarted();
    await pendingResponse;
    await route.fulfill({ status: 503, json: { detail: 'Synthetic service failure.' } });
  });
  const account = await createVerifiedAccount();
  await signInThroughApp(page, account);
  await openWorkspacePage(page, 'Job Discovery');
  await page.getByRole('button', { name: 'Discover Jobs' }).click();

  await waitingForSearch;
  await expect(page.getByRole('status').filter({ hasText: 'Loading job listings' })).toBeVisible();
  releaseResponse();
  await expect(page.getByRole('alert')).toContainText('Synthetic service failure.');
});

test('authenticated profile, discovery, tracker, and learning pages pass axe checks', async ({ page }) => {
  await mockBackend(page);
  const violations = [];
  const account = await createVerifiedAccount();
  await signInThroughApp(page, account);

  for (const [pageName, heading] of [
    ['Student Profile', 'Profile overview'],
    ['Job Discovery', 'Discover Your Next Opportunity'],
    ['Job Application Tracker', 'Job Application Tracker'],
    ['Skill Gap & Learning Resources', 'Skill gap & learning resources.'],
  ]) {
    await openWorkspacePage(page, pageName);
    if (heading === 'Profile overview') {
      await expect(page.getByRole('region', { name: 'Profile overview' })).toBeVisible();
    } else {
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    }
    violations.push(...await getAxeViolations(page, pageName));
  }
  expectNoAxeViolations(violations);
});

test('mobile navigation is operable and reduced-motion preferences are respected', async ({ page }) => {
  await mockBackend(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');

  const menuButton = page.getByRole('button', { name: 'Open navigation menu' });
  await expect(menuButton).toBeVisible();
  await menuButton.focus();
  await expect(menuButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Close navigation menu' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Features' })).toBeVisible();

  const motionValues = await page.locator('.hero-copy').evaluate((element) => ({
    animationDuration: getComputedStyle(element).animationDuration,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
  }));
  expect(Number.parseFloat(motionValues.animationDuration)).toBeLessThanOrEqual(0.00001);
  expect(motionValues.scrollBehavior).toBe('auto');
});

test('native confirmation dialog can be dismissed without deleting an application', async ({ page }) => {
  await mockBackend(page);
  const account = await createVerifiedAccount();
  await signInThroughApp(page, account);
  await openWorkspacePage(page, 'Job Application Tracker');

  await page.getByRole('button', { name: 'Add application' }).click();
  await page.getByLabel('Company name').fill('Synthetic Dialog Company');
  await page.getByRole('textbox', { name: 'Job title' }).fill('Synthetic Dialog Role');
  await page.getByRole('button', { name: 'Add application', exact: true }).last().click();
  const application = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'Synthetic Dialog Role' }),
  });
  await expect(application.getByText('Saved', { exact: true })).toBeVisible();
  const dialogPromise = page.waitForEvent('dialog');
  const deletion = application.getByRole('button', { name: 'Delete' }).click();
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe('confirm');
  expect(dialog.message()).toContain('Synthetic Dialog Role');
  await page.keyboard.press('Escape');
  await dialog.dismiss();
  await deletion;
  await expect(application.getByRole('heading', { name: 'Synthetic Dialog Role' })).toBeVisible();
});

test('unauthenticated protected-route redirection retains accessible sign-in controls', async ({ page }) => {
  await mockBackend(page);
  await page.goto('/#student-profile');

  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Email address' })).toHaveAccessibleName('Email address');
  await expect(page.getByLabel('Password')).toHaveAccessibleName('Password');
  expectNoAxeViolations(await getAxeViolations(page, 'protected route sign-in page'));
});
