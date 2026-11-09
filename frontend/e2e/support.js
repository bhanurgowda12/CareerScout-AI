import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFile } from 'node:fs/promises';

const projectId = 'demo-careerscout-ai';
const authEmulator = 'http://127.0.0.1:9099';
const emulatorApiKey = 'playwright-fake-api-key';

async function authRequest(path, body) {
  const response = await fetch(
    `${authEmulator}/identitytoolkit.googleapis.com/v1/${path}?key=${emulatorApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Auth emulator request failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload;
}

export async function createVerifiedAccount() {
  const suffix = randomUUID();
  const email = `playwright-${suffix}@example.test`;
  const password = `E2e-${randomUUID()}-Pass9`;
  const created = await authRequest('accounts:signUp', {
    email,
    password,
    returnSecureToken: true,
  });
  const verification = await authRequest('accounts:sendOobCode', {
    requestType: 'VERIFY_EMAIL',
    idToken: created.idToken,
  });
  let oobCode = verification.oobCode;
  if (!oobCode) {
    const codesResponse = await fetch(`${authEmulator}/emulator/v1/projects/${projectId}/oobCodes`);
    const codes = await codesResponse.json();
    oobCode = codes.oobCodes?.find((item) => item.email === email)?.oobCode;
  }
  if (!oobCode) throw new Error('Auth emulator did not provide an email verification code.');
  const verified = await authRequest('accounts:update', {
    oobCode,
    returnSecureToken: true,
  });
  expect(verified.emailVerified).toBe(true);
  const signedIn = await authRequest('accounts:signInWithPassword', {
    email,
    password,
    returnSecureToken: true,
  });
  const accountInfo = await authRequest('accounts:lookup', { idToken: signedIn.idToken });
  expect(accountInfo.users?.[0]?.emailVerified).toBe(true);
  return { uid: created.localId, email, password, idToken: signedIn.idToken };
}

export async function createRulesTestEnvironment() {
  return initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'),
    },
  });
}

export async function installNetworkBoundary(page) {
  return page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
      return route.continue();
    }
    return route.abort('blockedbyclient');
  });
}

export async function signInThroughApp(page, account) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.locator('.auth-page').getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Choose your username' })).toBeVisible();
  const username = `student_${randomUUID().slice(0, 8)}`;
  await page.getByRole('textbox', { name: 'Username' }).fill(username);
  await page.getByRole('button', { name: 'Save and Continue' }).click();
  await expect(page.getByRole('navigation', { name: 'Workspace' })).toBeVisible();
  return username;
}

export async function openWorkspacePage(page, name) {
  await page.getByRole('navigation', { name: /Career Growth|Job Search/ })
    .getByRole('button', { name, exact: true })
    .click();
}
