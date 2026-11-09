import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DEV_API_BASE_URL,
  DEFAULT_JOB_DISCOVERY_TIMEOUT_MS,
  DEFAULT_LEARNING_RESOURCES_TIMEOUT_MS,
  getApiBaseUrl,
  getApiTimeoutMs,
  REQUIRED_FIREBASE_ENV_KEYS,
  shouldUseFirebaseEmulators,
  validateProductionEnvironment,
} from '../src/environmentConfig.js';

function productionEnvironment(overrides = {}) {
  return {
    ...Object.fromEntries(REQUIRED_FIREBASE_ENV_KEYS.map((key) => [key, `configured-${key}`])),
    VITE_FIREBASE_APP_CHECK_SITE_KEY: 'configured-app-check-site-key',
    VITE_FIREBASE_APP_CHECK_DEBUG: 'false',
    VITE_API_BASE_URL: 'https://api.example.com/',
    ...overrides,
  };
}

test('development defaults to localhost when the API URL is not set', () => {
  assert.equal(getApiBaseUrl({}, { isProduction: false }), DEFAULT_DEV_API_BASE_URL);
});

test('development accepts and normalizes a configured localhost API URL', () => {
  assert.equal(
    getApiBaseUrl({ VITE_API_BASE_URL: 'http://127.0.0.1:8000///' }),
    'http://127.0.0.1:8000',
  );
});

test('development rejects malformed API URLs and unsupported schemes', () => {
  assert.throws(() => getApiBaseUrl({ VITE_API_BASE_URL: 'not-a-url' }), /absolute HTTP or HTTPS URL/);
  assert.throws(() => getApiBaseUrl({ VITE_API_BASE_URL: 'ftp://api.example.com' }), /absolute HTTP or HTTPS URL/);
});

test('API timeout defaults align with the backend deadline and accept explicit overrides', () => {
  assert.equal(getApiTimeoutMs({}, 'VITE_JOB_DISCOVERY_TIMEOUT_MS', DEFAULT_JOB_DISCOVERY_TIMEOUT_MS), 17_000);
  assert.equal(getApiTimeoutMs({}, 'VITE_LEARNING_RESOURCES_TIMEOUT_MS', DEFAULT_LEARNING_RESOURCES_TIMEOUT_MS), 15_000);
  assert.equal(getApiTimeoutMs({ VITE_JOB_DISCOVERY_TIMEOUT_MS: '22000' }, 'VITE_JOB_DISCOVERY_TIMEOUT_MS', 17_000), 22_000);
  assert.throws(
    () => getApiTimeoutMs({ VITE_LEARNING_RESOURCES_TIMEOUT_MS: '0' }, 'VITE_LEARNING_RESOURCES_TIMEOUT_MS', 15_000),
    /whole number between/,
  );
});

test('production accepts valid explicit HTTPS API and Firebase/App Check configuration', () => {
  const env = productionEnvironment({ VITE_API_BASE_URL: 'https://api.example.com/v1/' });
  validateProductionEnvironment(env);
  assert.equal(getApiBaseUrl(env, { isProduction: true }), 'https://api.example.com/v1');
});

test('production requires an explicit HTTPS API URL and rejects local endpoints', () => {
  for (const VITE_API_BASE_URL of [
    undefined,
    'http://api.example.com',
    'http://localhost:8000',
    'https://localhost:8000',
    'http://127.0.0.1:8000',
    'https://127.12.0.1:8000',
    'http://[::1]:8000',
  ]) {
    assert.throws(
      () => validateProductionEnvironment(productionEnvironment({ VITE_API_BASE_URL })),
      /VITE_API_BASE_URL/,
    );
  }
});

test('production requires every Firebase web setting and App Check site key', () => {
  const missingFirebase = Object.fromEntries(REQUIRED_FIREBASE_ENV_KEYS.map((key) => [key, '']));
  assert.throws(
    () => validateProductionEnvironment(productionEnvironment({
      ...missingFirebase,
      VITE_FIREBASE_APP_CHECK_SITE_KEY: 'YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY',
    })),
    /Missing required Firebase web configuration/,
  );
  assert.throws(
    () => validateProductionEnvironment(productionEnvironment({ VITE_FIREBASE_APP_CHECK_SITE_KEY: '' })),
    /VITE_FIREBASE_APP_CHECK_SITE_KEY is required/,
  );
});

test('production rejects Firebase placeholders and App Check debug mode', () => {
  assert.throws(
    () => validateProductionEnvironment(productionEnvironment({
      VITE_FIREBASE_API_KEY: 'YOUR_FIREBASE_API_KEY',
    })),
    /Missing required Firebase web configuration/,
  );
  assert.throws(
    () => validateProductionEnvironment(productionEnvironment({ VITE_FIREBASE_APP_CHECK_DEBUG: 'true' })),
    /VITE_FIREBASE_APP_CHECK_DEBUG must not be enabled/,
  );
});

test('Firebase emulators require explicit development configuration', () => {
  assert.equal(shouldUseFirebaseEmulators({}, { isDevelopment: true }), false);
  assert.equal(shouldUseFirebaseEmulators({ VITE_FIREBASE_USE_EMULATORS: 'true' }, { isDevelopment: true }), true);
  assert.equal(shouldUseFirebaseEmulators({ VITE_FIREBASE_USE_EMULATORS: 'TRUE' }, { isDevelopment: true }), true);
  assert.throws(
    () => shouldUseFirebaseEmulators({ VITE_FIREBASE_USE_EMULATORS: 'true' }, { isDevelopment: false }),
    /only be enabled in development/,
  );
  assert.throws(
    () => validateProductionEnvironment(productionEnvironment({ VITE_FIREBASE_USE_EMULATORS: 'true' })),
    /only be enabled in development/,
  );
});
