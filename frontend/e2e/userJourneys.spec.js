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

test('student profile edits persist in Firestore after reload', async ({ page }) => {
  await mockBackend(page);
  const account = await createVerifiedAccount();
  const username = await signInThroughApp(page, account);
  await openWorkspacePage(page, 'Student Profile');
  await expect(page.getByRole('heading', { level: 1, name: username })).toBeVisible();

  await page.getByLabel('Full name').fill('Synthetic E2E Student');
  await page.getByLabel('Email address').fill(account.email);
  await page.getByLabel('Degree').fill('Bachelor of Technology');
  await page.getByLabel('Branch or specialization').fill('Computer Science');
  await page.getByLabel('College name').fill('Synthetic Test College');
  await page.getByLabel('Graduation year').fill('2027');
  await page.getByLabel('Current level').selectOption('Beginner');
  await page.getByLabel('Software and application development').check();
  await page.getByRole('button', { name: 'Save Profile' }).click();
  await expect(page.getByText('Your profile has been saved to your account.')).toBeVisible();

  await page.reload();
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
