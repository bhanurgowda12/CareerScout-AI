import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { collection, doc, getDocs, setDoc } from 'firebase/firestore';
import {
  createRulesTestEnvironment,
  createVerifiedAccount,
  installNetworkBoundary,
  openWorkspacePage,
  signInThroughApp,
} from './support.js';

async function mockBackend(page, { jobs = [] } = {}) {
  await installNetworkBoundary(page);
  await page.route('http://127.0.0.1:8000/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/health') {
      await route.fulfill({ json: { status: 'ok', message: 'E2E mock backend' } });
      return;
    }
    if (url.pathname === '/api/job-discovery') {
      await route.fulfill({
        json: {
          jobs,
          source: 'Remotive',
          sources: ['Remotive'],
          providerStatus: [{ name: 'Remotive', status: 'ok', listingCount: jobs.length, matchedCount: jobs.length }],
          providerErrors: [],
          fetchedAt: '2026-01-15T12:00:00Z',
          cached: false,
        },
      });
      return;
    }
    if (url.pathname === '/api/learning-resources') {
      expect(route.request().headers().authorization).toMatch(/^Bearer .+/);
      await route.fulfill({
        json: {
          videos: [{
            videoId: 'synthetic-e2e-video',
            title: 'Synthetic learning resource',
            channelName: 'E2E Learning Channel',
            videoUrl: 'https://www.youtube.com/watch?v=synthetic-e2e-video',
            thumbnailUrl: '',
          }],
          nextPageToken: null,
        },
      });
      return;
    }
    await route.fulfill({ status: 503, json: { detail: 'Not configured in E2E tests.' } });
  });
}

test('Auth emulator account can sign in to protected pages and sign out', async ({ page }) => {
  await mockBackend(page);
  const account = await createVerifiedAccount();

  await signInThroughApp(page, account);
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText(account.email)).toBeVisible();
  await page.getByRole('button', { name: 'Sign Out' }).click();

  await expect(page.getByRole('heading', { level: 1, name: /Your future is/i })).toBeVisible();
  await page.goto('/#student-profile');
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
});

test('student profile routes create, cancel, update, view, restore, and delete snapshots', async ({ page }) => {
  await mockBackend(page);
  const account = await createVerifiedAccount();
  await signInThroughApp(page, account);
  await openWorkspacePage(page, 'Student Profile');
  await expect(page.getByRole('region', { name: 'Profile overview' })).toBeVisible();
  await expect(page).toHaveURL(/#student-profile$/);
  const profileSidebarButton = page.getByRole('navigation', { name: 'Career Growth' })
    .getByRole('button', { name: 'Student Profile', exact: true });
  await expect(profileSidebarButton).toHaveAttribute('aria-current', 'page');

  await page.getByRole('button', { name: 'Create / Edit Profile', exact: true }).click();
  await expect(page).toHaveURL(/#student-profile-edit$/);
  await expect(profileSidebarButton).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1, name: /Create your profile|Edit your profile/ })).toBeVisible();

  await page.getByLabel('Full name').fill('Synthetic E2E Student');
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Degree').fill('Bachelor of Technology');
  await page.getByLabel('Branch or specialization').fill('Computer Science');
  await page.getByLabel('College name').fill('Synthetic Test College');
  await page.getByLabel('Graduation year').fill('2027');
  await page.getByLabel('Current level').selectOption('Beginner');
  await page.getByLabel('Software and application development').check();
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page).toHaveURL(/#student-profile$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Synthetic E2E Student' })).toBeVisible();
  await expect(page.getByText('100%', { exact: true })).toBeVisible();

  await page.locator('.profile-overview-actions').getByRole('button', { name: 'Profile History', exact: true }).click();
  await expect(page).toHaveURL(/#student-profile-history$/);
  await expect(profileSidebarButton).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('listitem').filter({ hasText: 'Before profile update' })).toHaveCount(1);

  await page.getByRole('button', { name: 'Create / Edit Profile', exact: true }).click();
  await page.getByLabel('Full name').fill('Unsaved E2E Edit');
  const cancelDialog = page.waitForEvent('dialog');
  const cancelClick = page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await (await cancelDialog).accept();
  await cancelClick;
  await expect(page.getByRole('heading', { level: 2, name: 'Synthetic E2E Student' })).toBeVisible();
  await expect(page.getByText('Unsaved E2E Edit')).toHaveCount(0);

  await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
  await page.getByLabel('Full name').fill('Updated E2E Student');
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page).toHaveURL(/#student-profile$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Updated E2E Student' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'Updated E2E Student' })).toBeVisible();
  await page.locator('.profile-overview-actions').getByRole('button', { name: 'Profile History', exact: true }).click();
  const oldVersion = page.getByRole('listitem').filter({ hasText: 'Before profile update' }).first();
  await expect(oldVersion).toBeVisible();
  await oldVersion.getByRole('button', { name: 'View version' }).click();
  await expect(page.getByRole('heading', { name: 'Previous profile' })).toBeVisible();
  await expect(page.locator('.history-details')).toContainText('Synthetic E2E Student');
  const restoreDialog = page.waitForEvent('dialog');
  const restoreClick = page.getByRole('button', { name: 'Restore this version' }).click();
  await (await restoreDialog).accept();
  await restoreClick;
  await expect(page.getByText(/The selected version was restored/)).toBeVisible();
  await page.getByRole('button', { name: 'Profile Overview', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Synthetic E2E Student' })).toBeVisible();

  await page.locator('.profile-overview-actions').getByRole('button', { name: 'Profile History', exact: true }).click();
  const beforeUpdateVersions = page.getByRole('listitem').filter({ hasText: 'Before profile update' });
  await expect(beforeUpdateVersions.first()).toBeVisible();
  const beforeUpdateCount = await beforeUpdateVersions.count();
  const versionToDelete = beforeUpdateVersions.first();
  const deleteDialog = page.waitForEvent('dialog');
  const deleteClick = versionToDelete.getByRole('button', { name: 'Delete', exact: true }).click();
  const deletePrompt = await deleteDialog;
  expect(deletePrompt.type()).toBe('confirm');
  await deletePrompt.accept();
  await deleteClick;
  await expect(beforeUpdateVersions).toHaveCount(beforeUpdateCount - 1);

  await page.getByRole('button', { name: 'Profile Overview', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'Synthetic E2E Student' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
  await expect(page.getByLabel('Full name')).toHaveValue('Synthetic E2E Student');
  await expect(page.getByLabel('College name')).toHaveValue('Synthetic Test College');
});

test('job discovery searches mocked listings and filters to remote results', async ({ page }) => {
  const submittedSearches = [];
  const jobs = [
    {
      id: 'synthetic-remote',
      title: 'Synthetic Remote QA Engineer',
      company: 'Synthetic Remote Co',
      url: 'https://remotive.com/remote-jobs/software-dev/synthetic-remote-qa-engineer',
      source: 'Remotive',
      isRemote: true,
      location: 'Remote',
      description: 'Synthetic E2E listing for a remote quality engineer.',
    },
    {
      id: 'synthetic-office',
      title: 'Synthetic Office QA Engineer',
      company: 'Synthetic Office Co',
      url: 'https://remotive.com/remote-jobs/software-dev/synthetic-office-qa-engineer',
      source: 'Remotive',
      isRemote: false,
      location: 'Bengaluru',
      description: 'Synthetic E2E listing for an office quality engineer.',
    },
  ];
  await mockBackend(page, { jobs });
  await page.route('http://127.0.0.1:8000/api/job-discovery', async (route) => {
    submittedSearches.push(JSON.parse(route.request().postData() || '{}'));
    await route.fulfill({
      json: {
        jobs,
        source: 'Remotive',
        sources: ['Remotive'],
        providerStatus: [{ name: 'Remotive', status: 'ok', listingCount: jobs.length, matchedCount: jobs.length }],
        providerErrors: [],
        fetchedAt: '2026-01-15T12:00:00Z',
        cached: false,
      },
    });
  });
  const account = await createVerifiedAccount();
  await signInThroughApp(page, account);
  await openWorkspacePage(page, 'Job Discovery');

  await page.getByRole('searchbox', { name: 'Custom title or keyword' }).fill('Synthetic');
  await page.getByLabel('Work mode').selectOption({ label: 'Remote' });
  await page.getByRole('button', { name: 'Discover Jobs' }).click();

  await expect(page.getByRole('heading', { name: '1 listing shown' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Synthetic Remote QA Engineer' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Synthetic Office QA Engineer' })).toHaveCount(0);
  expect(submittedSearches).toHaveLength(1);
  expect(submittedSearches[0]).toMatchObject({ query: 'Synthetic', workMode: 'Remote' });
});

test('job discovery cards present complete and sparse source data accessibly across themes and actions', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const description = `Required skills: React and Python. TypeScript is preferred. ${'Build useful tools with a collaborative team. '.repeat(12)} END_OF_SYNTHETIC_DESCRIPTION`;
  const jobs = [
    {
      id: 'synthetic-complete',
      title: 'Synthetic Product Engineer',
      company: 'Synthetic Labs',
      url: 'https://remotive.com/remote-jobs/software-dev/synthetic-product-engineer',
      source: 'Remotive',
      sourceLabel: 'Remotive job aggregator',
      category: 'Product Engineering',
      location: 'Bengaluru',
      workMode: 'Hybrid',
      employmentType: 'Full-time',
      experienceLevel: 'Entry level',
      experienceMetadata: [{ label: 'Experience Level', value: 'Entry level' }],
      salary: 'INR 900,000–1,200,000 yearly',
      publicationDate: '2026-01-15T12:00:00Z',
      skills: ['React', 'Python', 'TypeScript'],
      description,
    },
    {
      id: 'synthetic-sparse',
      title: 'Synthetic Junior Designer',
      company: 'Sparse Listings Co',
      url: 'https://remotive.com/remote-jobs/design/synthetic-junior-designer',
      source: 'Remotive',
    },
  ];
  await mockBackend(page, { jobs });
  const account = await createVerifiedAccount();
  const testEnvironment = await createRulesTestEnvironment();
  try {
    const seedDb = testEnvironment.authenticatedContext(account.uid, {
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    }).firestore();
    await setDoc(doc(seedDb, 'users', account.uid, 'profile', 'profile'), {
      fullName: 'Synthetic Profile',
      skills: ['React'],
      interests: ['Product Engineering'],
      experienceLevel: 'Beginner',
      preferredLocations: ['Bengaluru'],
      preferredWorkModes: ['Hybrid'],
      preferredEmploymentTypes: ['Full-time'],
    });

    await signInThroughApp(page, account);
    await openWorkspacePage(page, 'Job Discovery');
    await page.getByRole('button', { name: 'Discover Jobs' }).click();

    const completeCard = page.locator('.job-discovery-card').filter({
      has: page.getByRole('heading', { name: 'Synthetic Product Engineer' }),
    });
    const sparseCard = page.locator('.job-discovery-card').filter({
      has: page.getByRole('heading', { name: 'Synthetic Junior Designer' }),
    });
    await expect(completeCard).toBeVisible();
    await expect(sparseCard).toBeVisible();
    await expect(completeCard.locator('.job-discovery-category-tag')).toHaveText('Product Engineering');
    const infoGrid = completeCard.locator('.job-discovery-info-grid');
    await expect(infoGrid.getByText('Full-time', { exact: true })).toBeVisible();
    await expect(infoGrid.getByText('Hybrid', { exact: true })).toBeVisible();
    await expect(infoGrid.getByText('Bengaluru', { exact: true })).toBeVisible();
    await expect(infoGrid.getByText('INR 900,000–1,200,000 yearly')).toBeVisible();
    await expect(completeCard.getByRole('heading', { name: 'Explicitly required in the posting' })).toBeVisible();
    await expect(completeCard.getByRole('heading', { name: 'Preferred', exact: true })).toBeVisible();
    await expect(sparseCard.getByText('No role description provided by the source.')).toBeVisible();
    await expect(sparseCard.getByText('No skills were provided by the source.')).toBeVisible();
    await expect(sparseCard.getByText('Not specified', { exact: true })).toHaveCount(5);
    await expect(sparseCard.locator('.job-discovery-info-item p')).toContainText('Inferred from job title');

    const readMore = completeCard.getByRole('button', { name: 'Read more' });
    await expect(readMore).toHaveAttribute('aria-expanded', 'false');
    await expect(completeCard.getByText('END_OF_SYNTHETIC_DESCRIPTION')).toHaveCount(0);
    await readMore.click();
    await expect(completeCard.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
    await expect(completeCard.getByText('END_OF_SYNTHETIC_DESCRIPTION')).toBeVisible();
    await completeCard.getByRole('button', { name: 'Show less' }).click();
    await expect(completeCard.getByText('END_OF_SYNTHETIC_DESCRIPTION')).toHaveCount(0);

    const profileComparison = completeCard.getByRole('button', { name: 'Compare with profile' });
    const preparation = completeCard.getByRole('button', { name: 'Prepare for this job' });
    await expect(profileComparison).toBeEnabled();
    await expect(preparation).toBeEnabled();
    await expect(completeCard.getByText('React', { exact: true }).first()).toBeVisible();
    await expect(completeCard.getByText('Python', { exact: true }).first()).toBeVisible();
    await profileComparison.click();
    await expect(completeCard.getByRole('region', { name: 'Profile comparison for Synthetic Product Engineer' })).toBeVisible();
    await preparation.click();
    await expect(completeCard.getByRole('heading', { name: '4-week preparation roadmap' })).toBeVisible();

    await expect(completeCard.getByRole('link', { name: /View original posting/ }))
      .toHaveAttribute('href', jobs[0].url);
    await expect(completeCard.getByRole('button', { name: 'Save Synthetic Product Engineer to the job tracker' })).toBeVisible();

    const lightCardBackground = await completeCard.evaluate((element) => getComputedStyle(element).backgroundColor);
    await page.locator('html').evaluate((element) => { element.dataset.theme = 'dark'; });
    await expect.poll(() => completeCard.evaluate((element) => getComputedStyle(element).backgroundColor))
      .not.toBe(lightCardBackground);
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileDimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      page: document.documentElement.scrollWidth,
    }));
    expect(mobileDimensions.page).toBeLessThanOrEqual(mobileDimensions.viewport);
    await page.setViewportSize({ width: 1280, height: 900 });

    await completeCard.getByRole('button', { name: 'Save job in tracker' }).click();
    await expect(page.getByRole('heading', { name: 'Job Application Tracker' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Job title' })).toHaveValue('Synthetic Product Engineer');
    await page.getByRole('button', { name: 'Back to Student Dashboard' }).click();
    await expect(page.getByRole('heading', { name: 'Discover Your Next Opportunity' })).toBeVisible();
    await page.getByRole('button', { name: 'Discover Jobs' }).click();
    const refreshedCard = page.locator('.job-discovery-card').filter({
      has: page.getByRole('heading', { name: 'Synthetic Product Engineer' }),
    });
    await refreshedCard.getByRole('button', { name: 'Open AI job analyzer' }).click();
    await expect(page.getByRole('heading', { name: /AI Job Match/ })).toBeVisible();
    await expect(page.getByLabel('Job description')).toHaveValue(description);
    expect(pageErrors).toEqual([]);
  } finally {
    await testEnvironment.cleanup();
  }
});

test('application tracker saves and updates application status across reloads', async ({ page }) => {
  await mockBackend(page);
  const account = await createVerifiedAccount();
  await signInThroughApp(page, account);
  await openWorkspacePage(page, 'Job Application Tracker');

  await page.getByRole('button', { name: 'Add application' }).click();
  await page.getByLabel('Company name').fill('Synthetic E2E Company');
  await page.getByRole('textbox', { name: 'Job title' }).fill('Synthetic E2E Developer');
  await page.getByLabel('Job posting URL').fill('https://example.test/jobs/synthetic-e2e');
  await page.getByRole('button', { name: 'Add application', exact: true }).last().click();

  const application = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'Synthetic E2E Developer' }),
  });
  await expect(application.getByText('Saved', { exact: true })).toBeVisible();
  await application.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Application status').selectOption('Applied');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(application.getByText('Applied', { exact: true })).toBeVisible();

  await page.reload();
  const persistedApplication = page.getByRole('listitem').filter({
    has: page.getByRole('heading', { name: 'Synthetic E2E Developer' }),
  });
  await expect(persistedApplication.getByText('Applied', { exact: true })).toBeVisible();
});

test('learning progress is saved to Firestore and restored after reload', async ({ page }) => {
  await mockBackend(page);
  const account = await createVerifiedAccount();
  const recommendationId = `e2e-${randomUUID()}`;
  const testEnvironment = await createRulesTestEnvironment();
  try {
    const seedDb = testEnvironment.authenticatedContext(account.uid, {
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    }).firestore();
    await setDoc(doc(seedDb, 'users', account.uid, 'careerRecommendations', recommendationId), {
      careerRecommendations: [{
        careerPath: 'Software Engineer',
        careerId: 'software-engineer',
        pathwayId: 'javascript-node',
        pathwayName: 'JavaScript + Node.js',
        compatibilityScore: 75,
        whyItSuits: 'Synthetic recommendation for browser testing.',
        missingSkills: ['Python'],
        relevantSkills: [],
        transferableSkills: [],
      }],
      generationMethod: 'rule-based',
      generatedAt: new Date(),
    });
    await signInThroughApp(page, account);
    await openWorkspacePage(page, 'Skill Gap & Learning Resources');
    await expect(page.getByRole('heading', { name: 'Which language would you like to learn in?' })).toBeVisible();
    await page.getByLabel('English').check();
    await page.getByRole('button', { name: 'Search Learning Videos' }).click();

    await expect(page.getByRole('heading', { name: 'Software Engineer' })).toBeVisible();
    await expect(page.getByText('Synthetic learning resource').first()).toBeVisible();
    const skill = page.getByRole('article').filter({
      has: page.getByRole('heading', { name: 'Python', exact: true }),
    });
    await skill.getByRole('button', { name: 'Mark as completed' }).click();
    await expect(skill.getByRole('status')).toContainText('Completed');

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Which language would you like to learn in?' })).toBeVisible();
    await page.getByLabel('English').check();
    await page.getByRole('button', { name: 'Search Learning Videos' }).click();
    const persistedSkill = page.getByRole('article').filter({
      has: page.getByRole('heading', { name: 'Python', exact: true }),
    });
    await expect(persistedSkill.getByRole('button', { name: 'Mark as not completed' })).toBeVisible();
    await expect(persistedSkill.getByRole('status')).toContainText('Completed');

    const progressDb = testEnvironment.authenticatedContext(account.uid, {
      email_verified: true,
      firebase: { sign_in_provider: 'password' },
    }).firestore();
    const progress = await getDocs(collection(progressDb, 'users', account.uid, 'skillProgress'));
    expect(progress.docs.map((entry) => entry.data())).toEqual(expect.arrayContaining([
      expect.objectContaining({
        careerPath: 'Software Engineer',
        skill: 'Python',
        completed: true,
      }),
    ]));
  } finally {
    await testEnvironment.cleanup();
  }
});

test('dark and light themes render every workspace page without responsive overflow', async ({ page }) => {
  await mockBackend(page);
  await page.addInitScript(() => localStorage.setItem('careerscout-theme-preference', 'dark'));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /Your future is/i })).toBeVisible();
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe('dark');
  await expect(page.locator('html')).toHaveCSS('background-color', 'rgb(5, 5, 5)');
  await expect(page.locator('.workflow-steps li > span').first()).toHaveCSS('color', 'rgb(129, 140, 248)');
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/#sign-in');
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome back.' })).toBeVisible();
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe('dark');
  await page.goto('/#get-started');
  await expect(page.getByRole('heading', { level: 1, name: 'Create your account.' })).toBeVisible();
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe('dark');

  const account = await createVerifiedAccount();
  await signInThroughApp(page, account);

  await page.getByRole('navigation', { name: 'Account' }).getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.settings-page')).toBeVisible();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe('dark');
  await page.reload();
  await expect(page.locator('.settings-page')).toBeVisible();
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe('dark');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--page-background').trim())).toBe('#050505');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(5, 5, 5)');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(5, 5, 5)');
  await page.getByRole('button', { name: 'Light', exact: true }).click();
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe('light');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--page-background').trim())).toBe('#f7f7f2');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(247, 247, 242)');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect.poll(() => page.locator('html').getAttribute('data-theme')).toBe('dark');

  const routes = [
    { name: 'Dashboard', selector: '.dashboard-page', section: 'Workspace' },
    { name: 'Student Profile', selector: '.profile-page', section: 'Career Growth' },
    { name: 'Career Recommendations', selector: '.recommendations-page', section: 'Career Growth' },
    { name: 'Skill Gap & Learning Resources', selector: '.skill-gap-page', section: 'Career Growth' },
    { name: 'Job Discovery', selector: '.job-discovery-page', section: 'Job Search' },
    { name: 'AI Job Match Analyzer', selector: '.job-match-page', section: 'Job Search' },
    { name: 'Job Application Tracker', selector: '.job-tracker-page', section: 'Job Search' },
    { name: 'Resume Builder', selector: '.resume-builder-page', section: 'Job Search' },
    { name: 'Settings', selector: '.settings-page', section: 'Account' },
  ];

  for (const route of routes) {
    await page.getByRole('navigation', { name: route.section }).getByRole('button', { name: route.name, exact: true }).click();

    const pageContent = page.locator(route.selector).first();
    await expect(pageContent, `${route.name} page`).toBeVisible();
    await expect(page.locator('.cursor-effect')).toBeVisible();
    await expect(page.locator('.cursor-effect')).toHaveCSS('pointer-events', 'none');

    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), {
        message: `${route.name} should not overflow at ${width}px`,
      }).toBe(true);
      expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    if (route.name === 'Student Profile') {
      for (const [label, heading] of [
        ['Create / Edit Profile', /Create your profile|Edit your profile/],
        ['Profile History', 'Profile history'],
      ]) {
        await page.getByRole('button', { name: label, exact: true }).click();
        await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        for (const width of [1440, 768, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
          expect(await page.locator('html').getAttribute('data-theme')).toBe('dark');
        }
        await page.setViewportSize({ width: 1440, height: 900 });
      }
      await page.getByRole('button', { name: 'Profile Overview', exact: true }).click();
    }
  }
});
