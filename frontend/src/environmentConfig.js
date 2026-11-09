export const DEFAULT_DEV_API_BASE_URL = 'http://127.0.0.1:8000';
export const DEFAULT_JOB_DISCOVERY_TIMEOUT_MS = 17_000;
export const DEFAULT_LEARNING_RESOURCES_TIMEOUT_MS = 15_000;
const MAX_API_TIMEOUT_MS = 600_000;

export const REQUIRED_FIREBASE_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

export function shouldUseFirebaseEmulators(env, { isDevelopment = false } = {}) {
  const enabled = typeof env.VITE_FIREBASE_USE_EMULATORS === 'string'
    && env.VITE_FIREBASE_USE_EMULATORS.trim().toLowerCase() === 'true';
  if (enabled && !isDevelopment) {
    throw new Error('VITE_FIREBASE_USE_EMULATORS can only be enabled in development builds.');
  }
  return enabled;
}

function isLocalHostname(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost'
    || host.endsWith('.localhost')
    || host === '::1'
    || host === '0.0.0.0'
    || /^127(?:\.\d{1,3}){3}$/.test(host);
}

export function getApiBaseUrl(env, { isProduction = false } = {}) {
  const configuredUrl = typeof env.VITE_API_BASE_URL === 'string'
    ? env.VITE_API_BASE_URL.trim()
    : '';
  if (!configuredUrl) {
    if (isProduction) {
      throw new Error('VITE_API_BASE_URL is required for production builds and must be an HTTPS URL.');
    }
    return DEFAULT_DEV_API_BASE_URL;
  }

  let url;
  try {
    url = new URL(configuredUrl);
  } catch {
    throw new Error('VITE_API_BASE_URL must be an absolute HTTP or HTTPS URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('VITE_API_BASE_URL must be an absolute HTTP or HTTPS URL without credentials, query, or fragment.');
  }
  if (isProduction && (url.protocol !== 'https:' || isLocalHostname(url.hostname))) {
    throw new Error('VITE_API_BASE_URL must use HTTPS and cannot point to localhost or a loopback address in production.');
  }

  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export function getApiTimeoutMs(env = {}, key, defaultValue) {
  const configured = env[key];
  if (configured === undefined || configured === null || configured === '') return defaultValue;
  const value = typeof configured === 'number' ? configured : Number(configured);
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_API_TIMEOUT_MS) {
    throw new Error(`${key} must be a whole number between 1 and ${MAX_API_TIMEOUT_MS} milliseconds.`);
  }
  return value;
}

function isConfigured(value) {
  return typeof value === 'string'
    && value.trim() !== ''
    && !/^YOUR_/i.test(value.trim());
}

export function validateProductionEnvironment(env) {
  const missingFirebaseKeys = REQUIRED_FIREBASE_ENV_KEYS.filter((key) => !isConfigured(env[key]));
  const errors = [];

  try {
    shouldUseFirebaseEmulators(env, { isDevelopment: false });
  } catch (error) {
    errors.push(error.message);
  }
  if (missingFirebaseKeys.length) {
    errors.push(`Missing required Firebase web configuration: ${missingFirebaseKeys.join(', ')}.`);
  }
  if (!isConfigured(env.VITE_FIREBASE_APP_CHECK_SITE_KEY)) {
    errors.push('VITE_FIREBASE_APP_CHECK_SITE_KEY is required for production App Check.');
  }
  if (env.VITE_FIREBASE_APP_CHECK_DEBUG?.trim().toLowerCase() === 'true') {
    errors.push('VITE_FIREBASE_APP_CHECK_DEBUG must not be enabled in production.');
  }

  try {
    getApiBaseUrl(env, { isProduction: true });
  } catch (error) {
    errors.push(error.message);
  }
  for (const [key, defaultValue] of [
    ['VITE_JOB_DISCOVERY_TIMEOUT_MS', DEFAULT_JOB_DISCOVERY_TIMEOUT_MS],
    ['VITE_LEARNING_RESOURCES_TIMEOUT_MS', DEFAULT_LEARNING_RESOURCES_TIMEOUT_MS],
  ]) {
    try {
      getApiTimeoutMs(env, key, defaultValue);
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length) {
    throw new Error(`Invalid production frontend configuration:\n- ${errors.join('\n- ')}`);
  }
}
